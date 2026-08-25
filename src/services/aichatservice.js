import supabase from "../config/supabaseclient";

export async function askAI(message) {
  const { data, error } = await supabase.functions.invoke("gemini-chat", {
    body: {
      message,
    },
  });

  console.log("AI DATA:", data);
  console.log("AI ERROR:", error);

  if (error) {
    console.error("AI function error:", error);

    if (error.context) {
      try {
        const responseText = await error.context.text();
        console.error("AI RAW ERROR:", responseText);
      } catch (e) {
        console.error("Could not read error response:", e);
      }
    }

    throw error;
  }

  return data.response;
}