const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const runtime = (globalThis as any).Deno;

const supabaseRequest = async (url: string, accessToken: string, apiKey: string) => {
  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await response.json();
  return { response, data };
};

runtime.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message } = await req.json();
    if (typeof message !== "string" || !message.trim()) {
      return jsonResponse({ error: "Message is required" }, 400);
    }

    const authorization = req.headers.get("Authorization");
    const accessToken = authorization?.replace(/^Bearer\s+/i, "");
    if (!accessToken) {
      return jsonResponse({ error: "You must be signed in to use the assistant" }, 401);
    }

    const supabaseUrl = runtime.env.get("SUPABASE_URL");
    const supabaseAnonKey = runtime.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = runtime.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Supabase environment is not configured" }, 500);
    }
    if (!geminiApiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY is not configured" }, 500);
    }

    const userResult = await supabaseRequest(
      `${supabaseUrl}/auth/v1/user`,
      accessToken,
      supabaseAnonKey,
    );
    if (!userResult.response.ok || !userResult.data?.id) {
      return jsonResponse({ error: "Your session is invalid or has expired" }, 401);
    }

    const patientId = userResult.data.id;
    const encodedPatientId = encodeURIComponent(patientId);
    const [visitsResult, vaccinesResult, deliveriesResult] = await Promise.all([
      supabaseRequest(
        `${supabaseUrl}/rest/v1/prenatal_visits?patient_id=eq.${encodedPatientId}&select=visit_date,visit_number,next_appt_date,next_appt_type,status,clinical_notes&order=visit_date.desc&limit=20`,
        accessToken,
        supabaseAnonKey,
      ),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/vaccinations?patient_id=eq.${encodedPatientId}&select=scheduled_vaccination,vaccinated_date,status,notes&order=scheduled_vaccination.asc&limit=30`,
        accessToken,
        supabaseAnonKey,
      ),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/deliveries?mother_id=eq.${encodedPatientId}&select=postpartum_visit_date,postpartum_attended_date,postpartum_remarks&order=postpartum_visit_date.asc&limit=10`,
        accessToken,
        supabaseAnonKey,
      ),
    ]);

    const queryError = [visitsResult, vaccinesResult, deliveriesResult]
      .find((result) => !result.response.ok);
    if (queryError) {
      console.error("Patient context query failed:", queryError.data);
      return jsonResponse({ error: "Unable to load your health information" }, 500);
    }

    const patientContext = JSON.stringify({
      prenatalVisits: visitsResult.data ?? [],
      vaccinations: vaccinesResult.data ?? [],
      postpartumVisits: deliveriesResult.data ?? [],
    });
    const prompt = `You are DASMOM+, a helpful maternal-health assistant. Answer using the patient data below when relevant. Never invent dates or medical records. If the data does not contain the answer, say so and advise the mother to contact her healthcare provider. For urgent warning signs, recommend immediate professional care. Keep answers concise.

Patient data:
${patientContext}

Mother's question:
${message.trim()}`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", result);
      return jsonResponse({ error: result.error?.message || "Gemini API request failed" }, response.status);
    }

    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return jsonResponse({ response: reply || "Sorry, I couldn't generate a response." });
  } catch (error) {
    console.error("Gemini function error:", error);
    return jsonResponse({ error: "Something went wrong while processing your request." }, 500);
  }
});