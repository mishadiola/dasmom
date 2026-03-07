import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, HeartPulse, Sparkles, BookOpen, Apple, Dumbbell,
    Brain, Baby, Syringe, Heart, Bookmark, BookmarkCheck,
    CheckCircle2, ChevronRight, Star, X
} from 'lucide-react';
import '../../styles/pages/PregnancyTips.css';

// ─── Full Tips Data ────────────────────────────────────────────────────
export const TIPS_DATA = [
    {
        id: '1',
        title: 'Crucial Nutrients for the First Trimester',
        category: 'Nutrition',
        description: 'Learn about folic acid, iron, and why they matter so much early in pregnancy.',
        fullContent: [
            {
                heading: 'Why Nutrition Matters Most Now',
                body: 'The first trimester is a critical window for your baby\'s development. During these early weeks, your baby\'s brain, spinal cord, heart, and major organs are forming. What you eat directly impacts these processes.'
            },
            {
                heading: 'Folic Acid (Folate)',
                body: 'Folic acid is the most important nutrient in early pregnancy. It helps prevent neural tube defects — serious birth defects of the brain and spine. Take 400–800 mcg daily. Food sources include leafy greens (spinach, kale), fortified cereals, lentils, and beans.'
            },
            {
                heading: 'Iron',
                body: 'Iron supports the development of the placenta and fetus. Your body needs more iron during pregnancy to make extra blood for your baby. Aim for 27 mg daily. Good sources: lean red meat, chicken, fish, beans, and tofu. Pair with Vitamin C to boost absorption.'
            },
            {
                heading: 'Calcium & Vitamin D',
                body: 'These nutrients work together to build your baby\'s bones and teeth. Aim for 1,000 mg of calcium and 600 IU of Vitamin D per day. Sources: dairy products, fortified plant milks, sardines, and sunlight exposure.'
            },
            {
                heading: 'Key Takeaway',
                body: 'A daily prenatal vitamin is highly recommended to fill any nutritional gaps. Always consult your midwife or doctor before starting any supplement.'
            }
        ],
        readTime: '4 min read',
        icon: <Apple size={22} />,
        colorClass: 'cat-nutrition',
        tipOfDay: false,
    },
    {
        id: '2',
        title: 'Safe Pregnancy Exercises for Every Trimester',
        category: 'Exercise & Fitness',
        description: 'Stay active safely with approved routines that keep you and baby healthy.',
        fullContent: [
            {
                heading: 'Benefits of Exercising During Pregnancy',
                body: 'Regular physical activity during pregnancy can reduce back pain, ease constipation, decrease your risk of gestational diabetes and preeclampsia, promote healthy weight gain, improve your mood and energy levels, and help you sleep better.'
            },
            {
                heading: 'First Trimester (Weeks 1–12)',
                body: 'Most exercises are safe if you were active before pregnancy. Good options: brisk walking, swimming, light jogging, prenatal yoga, and strength training with lighter weights. Avoid overheating and stay hydrated.'
            },
            {
                heading: 'Second Trimester (Weeks 13–26)',
                body: 'As your belly grows, modify exercises. Avoid lying flat on your back for prolonged periods as this can reduce blood flow to the baby. Focus on: modified squats, wall push-ups, pelvic floor (Kegel) exercises, swimming, and stationary cycling.'
            },
            {
                heading: 'Third Trimester (Weeks 27–40)',
                body: 'Focus on walking, gentle stretching, and prenatal yoga. Practice breathing techniques that will help during labor. Listen to your body — if something feels uncomfortable, stop.'
            },
            {
                heading: 'Warning Signs to Stop Exercising',
                body: 'Stop immediately and contact your healthcare provider if you experience: chest pain or palpitations, shortness of breath, dizziness or feeling faint, painful contractions, vaginal bleeding, or fluid leaking.'
            }
        ],
        readTime: '6 min read',
        icon: <Dumbbell size={22} />,
        colorClass: 'cat-exercise',
    },
    {
        id: '3',
        title: 'Managing Pregnancy Anxiety & Stress',
        category: 'Mental Health & Wellness',
        description: 'Tips for reducing stress and finding peace during your pregnancy journey.',
        fullContent: [
            {
                heading: 'It\'s Normal to Feel Anxious',
                body: 'Pregnancy brings enormous changes — physical, emotional, and social. Feeling anxious or overwhelmed is common and completely understandable. The important thing is to recognize it and seek support.'
            },
            {
                heading: 'Mindfulness & Deep Breathing',
                body: 'Practice mindful breathing: inhale for 4 counts, hold for 4, exhale for 6. Do this 5–10 minutes daily. Apps like Calm or Headspace have specific prenatal meditation programs that many mothers find helpful.'
            },
            {
                heading: 'Talk to Someone',
                body: 'Don\'t bottle up your feelings. Share with your partner, a trusted friend, or a family member. If anxiety is severe, speak with a mental health professional — there is no shame in seeking help.'
            },
            {
                heading: 'Rest and Sleep',
                body: 'Your body is working hard. Prioritize 7–9 hours of sleep per night. Use a pregnancy pillow for support. Take short naps if needed, especially in the first and third trimesters when fatigue is strongest.'
            },
            {
                heading: 'Limit Stressors',
                body: 'Reduce unnecessary stress where possible. Set limits on social media time, delegate tasks, and create a calm environment at home. Focus on what you can control and let go of what you cannot.'
            }
        ],
        readTime: '5 min read',
        icon: <Brain size={22} />,
        colorClass: 'cat-mental',
    },
    {
        id: '4',
        title: 'What to Expect at Your Prenatal Visits',
        category: 'Prenatal Care',
        description: 'A complete guide to tests, ultrasounds, and important questions to ask.',
        fullContent: [
            {
                heading: 'Why Regular Check-Ups Are Vital',
                body: 'Prenatal visits allow your healthcare provider to monitor you and your baby\'s health, catch any complications early, and ensure you are getting proper nutrition and rest. Missing visits increases risks for both mother and baby.'
            },
            {
                heading: 'First Visit (Week 6–10)',
                body: 'Confirms pregnancy, estimates due date, takes complete medical history, orders initial blood tests (CBC, blood type, Rh factor, blood sugar, hepatitis B, HIV, syphilis), urine tests, and schedules your first ultrasound.'
            },
            {
                heading: 'Regular Visit Check-Ups Include',
                body: 'At each visit expect: blood pressure check, weight measurement, urine test (protein and sugar), abdominal exam to measure uterine growth, listening to fetal heartbeat, and discussion of any symptoms or concerns.'
            },
            {
                heading: 'Recommended Visit Schedule (DOH Philippines)',
                body: '• Month 1–3: At least one visit\n• Month 4–6: At least one visit\n• Month 7–8: One visit per month\n• Month 9: One visit every 2 weeks\nMore frequent if high-risk.'
            },
            {
                heading: 'Questions to Bring to Your Visit',
                body: 'Write down your concerns beforehand: "Is my weight gain normal?", "What foods should I avoid?", "Can I travel?", "When should I go to the hospital?", "What are the warning signs I should watch for?"'
            }
        ],
        readTime: '7 min read',
        icon: <HeartPulse size={22} />,
        colorClass: 'cat-prenatal',
        tipOfDay: true,
    },
    {
        id: '5',
        title: 'Preparing for Postpartum Recovery',
        category: 'Postpartum Care',
        description: 'Essential steps to prepare your body and mind for the 4th trimester.',
        fullContent: [
            {
                heading: 'The "Fourth Trimester" — What Is It?',
                body: 'The period right after birth — roughly the first 12 weeks — is sometimes called the "fourth trimester." Your body is recovering from birth while you are also learning to care for a newborn. It can be intense.'
            },
            {
                heading: 'Physical Recovery',
                body: 'Whether you had a vaginal birth or C-section, your body needs time to heal. Expect: vaginal bleeding (lochia) for 2–6 weeks, breast engorgement, perineal soreness (vaginal birth), or incision pain (C-section). Rest as much as possible.'
            },
            {
                heading: 'Postpartum Essentials to Stock Up',
                body: 'Before giving birth, prepare: thick maxi pads, a peri bottle (for hygiene), comfortable loose clothing, easy nutritious snacks, and prepared meal packs. Having these ready reduces stress after delivery.'
            },
            {
                heading: 'Watch for Warning Signs',
                body: 'Contact your provider immediately for: heavy bleeding soaking more than one pad per hour, fever above 38°C, signs of wound infection, severe headache, chest pain, or feelings of harming yourself or your baby.'
            },
            {
                heading: 'Postpartum Depression is Real',
                body: 'Baby blues (mild sadness, mood swings in the first 2 weeks) is normal. But if sadness, hopelessness, or inability to bond with your baby persists beyond 2 weeks, it may be postpartum depression — seek help without shame.'
            }
        ],
        readTime: '6 min read',
        icon: <Sparkles size={22} />,
        colorClass: 'cat-postpartum',
    },
    {
        id: '6',
        title: 'Tetanus Toxoid (TT) Vaccine: What You Need to Know',
        category: 'Vaccinations & Supplements',
        description: 'Why TT vaccine is essential and what to expect when you get it.',
        fullContent: [
            {
                heading: 'What Is Tetanus Toxoid?',
                body: 'Tetanus Toxoid (TT) is a vaccine that protects both you and your newborn from tetanus — a serious disease caused by bacteria found in soil, dust, and animal feces. Neonatal tetanus is a leading cause of newborn death in developing countries.'
            },
            {
                heading: 'The DOH-Recommended TT Schedule',
                body: '• TT1: As early as possible in pregnancy\n• TT2: At least 4 weeks after TT1 (gives 3 years protection)\n• TT3: At least 6 months after TT2 (gives 5 years protection)\n• TT4: At least 1 year later (gives 10 years)\n• TT5: At least 1 year later (lifetime protection)'
            },
            {
                heading: 'Common Side Effects',
                body: 'Mild soreness, redness, or swelling at the injection site is normal and resolves within 1–3 days. You may also experience slight fever or muscle aches. Serious allergic reactions are extremely rare.'
            },
            {
                heading: 'Iron Supplementation',
                body: 'Alongside vaccination, iron and folate supplementation is recommended throughout pregnancy. Daily ferrous sulfate + folic acid tablets help prevent iron-deficiency anemia, which is common in pregnant Filipino women.'
            }
        ],
        readTime: '5 min read',
        icon: <Syringe size={22} />,
        colorClass: 'cat-vaccine',
    },
    {
        id: '7',
        title: 'Essential Newborn Care in the First Week',
        category: 'Newborn Care',
        description: 'Everything you need to know to care for your baby in those first precious days.',
        fullContent: [
            {
                heading: 'Skin-to-Skin Contact (Kangaroo Care)',
                body: 'Immediately after birth, skin-to-skin contact with your baby is vital. It regulates the baby\'s body temperature, stabilizes breathing and heart rate, promotes bonding, and stimulates breastfeeding. Hold your baby against your bare chest as much as possible.'
            },
            {
                heading: 'Breastfeeding',
                body: 'Initiate breastfeeding within the first hour of birth. Colostrum — the thick, yellowish first milk — is packed with antibodies and is the perfect first food. Breastfeed on demand, usually every 1.5–3 hours. Proper latch is key to avoid nipple pain.'
            },
            {
                heading: 'Umbilical Cord Care',
                body: 'Keep the umbilical cord stump clean and dry. Do NOT apply any substance (oil, powder, alcohol is no longer recommended by DOH). Fold the diaper below the stump. The stump falls off naturally in 1–3 weeks.'
            },
            {
                heading: 'Newborn Danger Signs',
                body: 'Seek immediate medical help if your baby has: difficulty breathing, yellowish skin within 24 hours of birth, not feeding well, temperature below 36.5°C or above 37.5°C, umbilical cord bleeding or foul smell, or convulsions.'
            },
            {
                heading: 'Newborn Screening',
                body: 'By law (RA 9288), newborn screening must be done 24–72 hours after birth. It detects metabolic disorders that, if treated early, prevent disability or death. This is done at the health center or hospital.'
            }
        ],
        readTime: '8 min read',
        icon: <Baby size={22} />,
        colorClass: 'cat-newborn',
    },
    {
        id: '8',
        title: 'Healthy Eating Tips for the Second Trimester',
        category: 'Nutrition',
        description: 'Your appetite is back — here\'s how to fuel both you and your growing baby right.',
        fullContent: [
            {
                heading: 'Second Trimester Nutrition Overview',
                body: 'From weeks 13–26, your baby is growing rapidly and you\'ll likely regain your appetite after first-trimester nausea. This is a great time to focus on nutrient-dense foods that support your baby\'s brain and bone development.'
            },
            {
                heading: 'Omega-3 Fatty Acids',
                body: 'DHA (a type of omega-3) is crucial for your baby\'s brain and eye development. Eat fish 2–3 times a week. Best choices: salmon, sardines, and bangus (milkfish). Avoid high-mercury fish like swordfish and king mackerel.'
            },
            {
                heading: 'Managing Heartburn',
                body: 'As your uterus grows, it puts pressure on your stomach. To manage heartburn: eat smaller, more frequent meals, avoid spicy and fatty foods, don\'t lie down right after eating, and sleep with your head slightly elevated.'
            },
            {
                heading: 'Stay Hydrated',
                body: 'Aim for 8–10 glasses of water per day. Dehydration can trigger Braxton Hicks contractions and increase the risk of urinary tract infections. Coconut water is an excellent electrolyte-rich option.'
            }
        ],
        readTime: '5 min read',
        icon: <Apple size={22} />,
        colorClass: 'cat-nutrition',
    },
    {
        id: '9',
        title: 'Understanding and Managing Pregnancy Discomforts',
        category: 'Prenatal Care',
        description: 'Common discomforts like back pain, swelling, and nausea — and how to cope.',
        fullContent: [
            {
                heading: 'Morning Sickness (Nausea & Vomiting)',
                body: 'Affects up to 80% of pregnant women, usually in the first trimester. Tips: eat small, frequent meals, keep crackers by your bed for the morning, avoid strong smells, try ginger tea or ginger candies, and stay hydrated with clear fluids.'
            },
            {
                heading: 'Back Pain',
                body: 'Your center of gravity shifts as your belly grows. Wear supportive, low-heeled shoes. Sleep on your side with a pillow between your knees. Avoid heavy lifting. Gentle prenatal yoga and warm (not hot) baths can help significantly.'
            },
            {
                heading: 'Swollen Feet and Ankles (Edema)',
                body: 'Some swelling is normal, especially in the third trimester. Elevate your feet when sitting, avoid standing for long periods, wear comfortable shoes, and reduce salt intake. Sudden severe swelling, especially in the face and hands, should be reported to your provider immediately.'
            },
            {
                heading: 'Leg Cramps',
                body: 'Common at night in the second and third trimesters. Stretch your calf before bed: flex your foot upward. Staying well-hydrated and getting adequate calcium and magnesium can help reduce frequency.'
            }
        ],
        readTime: '6 min read',
        icon: <HeartPulse size={22} />,
        colorClass: 'cat-prenatal',
    },
    {
        id: '10',
        title: 'Breastfeeding: Starting Strong',
        category: 'Postpartum Care',
        description: 'A practical guide to initiating and maintaining successful breastfeeding.',
        fullContent: [
            {
                heading: 'The Benefits of Breastfeeding',
                body: 'Breast milk is the perfect food for your baby. It provides all the nutrients they need in the right amounts, contains antibodies that protect against infections, reduces risks of asthma, allergies, and obesity, and promotes bonding. For the mother, it helps the uterus contract back to size and reduces risk of breast and ovarian cancer.'
            },
            {
                heading: 'Getting a Good Latch',
                body: 'A proper latch is the key to comfortable and effective breastfeeding. Your baby should take in most of the areola (dark skin around the nipple), not just the nipple. Signs of a good latch: no pain (initial mild discomfort is okay), you can hear swallowing, and baby is satisfied after feeds.'
            },
            {
                heading: 'How Often to Feed',
                body: 'Newborns need to feed frequently — typically every 1.5 to 3 hours, or 8–12 times in 24 hours. This frequent feeding establishes your milk supply. Do not watch the clock; watch your baby for hunger cues: rooting, hand-to-mouth, fussing.'
            },
            {
                heading: 'Common Challenges & Solutions',
                body: 'Sore nipples: check latch, apply lanolin cream. Low milk supply: feed more frequently, ensure proper latch, stay hydrated. Engorgement: feed on demand, apply warm compress before feeding. Mastitis: keep feeding from the affected breast, consult a doctor for antibiotics if needed.'
            }
        ],
        readTime: '7 min read',
        icon: <Heart size={22} />,
        colorClass: 'cat-postpartum',
    },
    {
        id: '11',
        title: 'Benefits of Prenatal Yoga and Stretching',
        category: 'Exercise & Fitness',
        description: 'How gentle yoga can ease discomfort and prepare you for labor.',
        fullContent: [
            {
                heading: 'Why Prenatal Yoga?',
                body: 'Prenatal yoga is one of the safest and most beneficial forms of exercise during pregnancy. It combines gentle stretching, breathing techniques, and mindfulness — all of which are directly applicable to labor and delivery.'
            },
            {
                heading: 'Physical Benefits',
                body: 'Reduces back and pelvic pain, improves flexibility and posture, strengthens muscles used during childbirth (especially hips, thighs, and core), improves circulation and reduces swelling in legs and feet.'
            },
            {
                heading: 'Mental and Emotional Benefits',
                body: 'Reduces stress and anxiety, improves sleep quality, helps you connect with your body and baby, builds a community with other pregnant mothers (if in a class setting).'
            },
            {
                heading: 'Safe Poses for Pregnancy',
                body: 'Cat-Cow stretch (relieves back pain), modified Child\'s Pose (hip opener), Butterfly Pose (opens hips for delivery), Warrior II (builds leg strength), and Legs-Up-The-Wall (reduces swelling). Always tell your instructor you are pregnant.'
            }
        ],
        readTime: '5 min read',
        icon: <Dumbbell size={22} />,
        colorClass: 'cat-exercise',
    },
    {
        id: '12',
        title: 'Self-Care for the New Mother',
        category: 'Mental Health & Wellness',
        description: 'Why taking care of yourself first makes you a better mom.',
        fullContent: [
            {
                heading: 'You Cannot Pour from an Empty Cup',
                body: 'New motherhood is incredibly demanding. The pressure to be "perfect" can be overwhelming. But the truth is: when you take care of your own physical and mental health, you are better able to care for your baby.'
            },
            {
                heading: 'Accept Help',
                body: 'When someone offers to cook, clean, or watch the baby while you sleep — say YES. It takes a village. Let go of any guilt about not doing everything alone. Delegate tasks to your partner, family members, or friends.'
            },
            {
                heading: 'Create Small Rituals',
                body: 'You don\'t need hours to recharge. Even 10 minutes of something you love — a warm cup of tea, journaling, listening to music, or a short walk — can significantly improve your mood and perspective.'
            },
            {
                heading: 'Stay Connected',
                body: 'Isolation is one of the biggest risks for postpartum depression. Join a mothers\' group, connect with other new moms online, attend barangay health programs — community support makes a real difference.'
            }
        ],
        readTime: '4 min read',
        icon: <Brain size={22} />,
        colorClass: 'cat-mental',
    },
];

const CATEGORIES = [
    'All',
    'Nutrition',
    'Exercise & Fitness',
    'Mental Health & Wellness',
    'Prenatal Care',
    'Postpartum Care',
    'Vaccinations & Supplements',
    'Newborn Care',
];

const CAT_ICONS = {
    'Nutrition': <Apple size={14} />,
    'Exercise & Fitness': <Dumbbell size={14} />,
    'Mental Health & Wellness': <Brain size={14} />,
    'Prenatal Care': <HeartPulse size={14} />,
    'Postpartum Care': <Heart size={14} />,
    'Vaccinations & Supplements': <Syringe size={14} />,
    'Newborn Care': <Baby size={14} />,
};

// ─── Local Storage Keys ────────────────────────────────────────────────
const LS_BOOKMARKS = 'pt_bookmarks';
const LS_READ = 'pt_read';

const getLS = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
};
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ─── Component ────────────────────────────────────────────────────────
const PregnancyTips = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [bookmarks, setBookmarks] = useState(() => getLS(LS_BOOKMARKS));
    const [readIds, setReadIds] = useState(() => getLS(LS_READ));
    const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

    const tipOfTheDay = TIPS_DATA.find(t => t.tipOfDay) || TIPS_DATA[3];

    const filteredTips = TIPS_DATA.filter(tip => {
        const matchesSearch = !searchTerm ||
            tip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tip.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tip.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'All' || tip.category === activeCategory;
        const matchesBookmark = !showBookmarksOnly || bookmarks.includes(tip.id);
        return matchesSearch && matchesCategory && matchesBookmark;
    });

    const toggleBookmark = (e, id) => {
        e.stopPropagation();
        const updated = bookmarks.includes(id)
            ? bookmarks.filter(b => b !== id)
            : [...bookmarks, id];
        setBookmarks(updated);
        setLS(LS_BOOKMARKS, updated);
    };

    const handleTipClick = (id) => {
        const updatedRead = readIds.includes(id) ? readIds : [...readIds, id];
        setReadIds(updatedRead);
        setLS(LS_READ, updatedRead);
        navigate(`/dashboard/user-tips/${id}`);
    };

    const isActiveFiler = searchTerm !== '' || activeCategory !== 'All' || showBookmarksOnly;
    const readCount = readIds.length;
    const totalCount = TIPS_DATA.length;
    const progressPct = Math.round((readCount / totalCount) * 100);

    return (
        <div className="pt-page">
            {/* ── Header ── */}
            <div className="pt-header">
                <div className="pt-header-text">
                    <h1>Pregnancy Tips &amp; Resources</h1>
                    <p>Expert guidance and care for every stage of your journey. 🌸</p>
                </div>
                <div className="pt-progress-pill">
                    <div className="pt-progress-ring">
                        <svg viewBox="0 0 36 36" className="pt-ring-svg">
                            <path
                                className="pt-ring-bg"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                                className="pt-ring-fill"
                                strokeDasharray={`${progressPct}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <span className="pt-ring-pct">{progressPct}%</span>
                    </div>
                    <div className="pt-progress-text">
                        <strong>You've read {readCount} of {totalCount} tips</strong>
                        <span>Keep learning! 💪</span>
                    </div>
                </div>
            </div>

            {/* ── Tip of the Day Banner ── */}
            {!isActiveFiler && (
                <div className="pt-tod-banner" onClick={() => handleTipClick(tipOfTheDay.id)}>
                    <div className="pt-tod-deco" />
                    <div className="pt-tod-deco pt-tod-deco--2" />
                    <div className="pt-tod-content">
                        <div className="pt-tod-label">
                            <Star size={14} /> Tip of the Day
                        </div>
                        <h2>{tipOfTheDay.title}</h2>
                        <p>{tipOfTheDay.description}</p>
                        <span className="pt-tod-cta">
                            Read Full Article <ChevronRight size={16} />
                        </span>
                    </div>
                    <div className={`pt-tod-icon-wrap ${tipOfTheDay.colorClass}`}>
                        {tipOfTheDay.icon}
                    </div>
                </div>
            )}

            {/* ── Controls ── */}
            <div className="pt-controls">
                <div className="pt-search-wrap">
                    <Search size={17} className="pt-search-ico" />
                    <input
                        type="text"
                        className="pt-search-input"
                        placeholder="Search: 'iron', 'exercise', 'vaccines'…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button className="pt-search-clear" onClick={() => setSearchTerm('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    className={`pt-bookmark-toggle ${showBookmarksOnly ? 'active' : ''}`}
                    onClick={() => setShowBookmarksOnly(v => !v)}
                    title="Show saved tips only"
                >
                    <Bookmark size={16} />
                    Saved
                </button>
            </div>

            {/* ── Category Tabs ── */}
            <div className="pt-cats-wrap">
                <div className="pt-categories">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            className={`pt-cat-btn ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {CAT_ICONS[cat]}
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Results Label ── */}
            <div className="pt-results-meta">
                <span>{filteredTips.length} article{filteredTips.length !== 1 ? 's' : ''} found</span>
                {isActiveFiler && (
                    <button className="pt-clear-all" onClick={() => {
                        setSearchTerm('');
                        setActiveCategory('All');
                        setShowBookmarksOnly(false);
                    }}>
                        Clear filters
                    </button>
                )}
            </div>

            {/* ── Grid ── */}
            <div className="pt-grid">
                {filteredTips.length > 0 ? (
                    filteredTips.map(tip => {
                        const isBookmarked = bookmarks.includes(tip.id);
                        const isRead = readIds.includes(tip.id);
                        return (
                            <div
                                key={tip.id}
                                className={`pt-card ${isRead ? 'pt-card--read' : ''}`}
                                onClick={() => handleTipClick(tip.id)}
                            >
                                {/* Card Header / Cover */}
                                <div className={`pt-card-cover ${tip.colorClass}`}>
                                    <div className="pt-card-cover-icon">{tip.icon}</div>
                                    <span className="pt-card-badge">{tip.category}</span>
                                    {isRead && (
                                        <span className="pt-card-read-badge">
                                            <CheckCircle2 size={11} /> Read
                                        </span>
                                    )}
                                </div>

                                {/* Bookmark toggle */}
                                <button
                                    className={`pt-card-bookmark ${isBookmarked ? 'bookmarked' : ''}`}
                                    onClick={e => toggleBookmark(e, tip.id)}
                                    title={isBookmarked ? 'Remove bookmark' : 'Save for later'}
                                >
                                    {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                                </button>

                                {/* Card Body */}
                                <div className="pt-card-body">
                                    <h3>{tip.title}</h3>
                                    <p>{tip.description}</p>
                                </div>

                                {/* Card Footer */}
                                <div className="pt-card-footer">
                                    <span className="pt-read-time">
                                        <BookOpen size={13} /> {tip.readTime}
                                    </span>
                                    <span className="pt-action-link">
                                        Read <ChevronRight size={13} />
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="pt-no-results">
                        <BookOpen size={52} />
                        <p>No tips found.</p>
                        <span>Try different keywords or clear your filters.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PregnancyTips;
