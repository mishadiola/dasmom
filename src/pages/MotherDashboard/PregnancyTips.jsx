import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, HeartPulse, Sparkles, BookOpen, Apple, Dumbbell,
    Brain, Baby, Syringe, Heart, Bookmark, BookmarkCheck,
    CheckCircle2, ChevronRight, Star, X, ShieldCheck
} from 'lucide-react';
import '../../styles/pages/PregnancyTips.css';

// ─── Full Tips Data ────────────────────────────────────────────────────
export const TIPS_DATA = [
    {
        id: '1',
        title: 'Mga Babala sa Kalusugan Habang Nagbubuntis',
        category: 'Prenatal Care',
        description: 'Pakiramdaman ang iyong katawan at ipagbigay-alam sa doktor, nars, o midwife kung may mapansing nakababahala.',
        fullContent: [
            {
                heading: 'Pumunta agad sa health center!',
                body: 'Nanay, kung maramdaman o mapansin ang alinman sa mga ito, pumunta agad sa health center!\n\n• Pamamaga o pamamanas ng mga binti, kamay, o mukha\n• Sakit ng ulo, pagkahilo, o panlalabo ng paningin\n• Pagdurugo ng puwerta\n• Pamumutla\n• Lagnat\n• Pagsusuka\n• Hirap na paghinga\n• Mahapdi na pag-ihi\n• Malabnaw o mala-tubig na lumalabas sa puwerta\n• Pagbagal o hindi paggalaw ng bata sa tiyan sa ika-2 trimester ng pagbubuntis (mas mababa sa 10 sipa sa loob ng 12 oras)\n• Matinding pananakit ng ulo na may kasamang panlalabo ng paningin\n• Matinding pananakit ng tiyan\n• Maagang pagputok ng panubigan'
            }
        ],
        readTime: '3 min read',
        icon: <HeartPulse size={22} />,
        colorClass: 'cat-prenatal',
        tipOfDay: true,
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '2',
        title: 'Mga Paalala para sa Malusog na Pagbubuntis',
        category: 'Prenatal Care',
        description: 'Makinig sa mga payong makabubuti sa iyo at sa dinadalang anak.',
        fullContent: [
            {
                heading: 'Mga Paalala para sa Malusog na Pagbubuntis',
                body: 'Makinig sa mga payong makabubuti sa iyo at sa dinadalang anak.\n\n• Maghanda para sa eksklusibong pagpapasuso ng anak. Alamin ang tamang paraan.\n• Kumain nang tama at siguraduhing may sapat na sustansiya at bitamina.\n• Umiwas sa mga pagkaing maalat.\n• Mag-ehersisyo nang angkop.\n• Huwag uminom ng gamot para sa anumang karamdaman nang walang pahintulot ng doktor.\n• Siguraduhing may sapat na tulog at pahinga.\n• Iwasan ang masasamang bisyo gaya ng paninigarilyo at pag-inom ng anumang may alcohol.\n• Maghanda ng mga sumusunod para sa posibleng emergency: pera, pagkukuhanan ng dugo, at transportasyon.\n• Ugaliing uminom ng tubig araw-araw.'
            }
        ],
        readTime: '3 min read',
        icon: <Apple size={22} />,
        colorClass: 'cat-nutrition',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '3',
        title: 'Mga Prenatal Check-up',
        category: 'Prenatal Care',
        description: 'Alamin ang mga dapat mangyari sa bawat check-up at siguraduhing ito ay magagampanan ng iyong health service provider.',
        fullContent: [
            {
                heading: 'Schedule ng Check-up',
                body: '• Unang Check-up\n• Pangalawa\n• Pangatlo\n• Pang-apat\n\nAlamin ang mga dapat mangyari sa bawat check-up at siguraduhing ito ay magagampanan ng iyong health service provider.'
            },
            {
                heading: 'Ano ang nangyayari sa prenatal check-up?',
                body: 'Layunin nito ay masuri, malaman, at malunasan ang mga kondisyon na posibleng maging mapanganib sa iyo at sa iyong baby.\n\n• Kukunin ang iyong medical at pregnancy history.\n• Susuriin ang iyong katawan.\n• Kukunin ang iyong blood pressure (BP), timbang, at iba pang vital signs.\n• Aalamin ang iyong nutritional status.\n• Gagawan ka ng laboratory tests.'
            },
            {
                heading: 'Para sa Kalusugan ni Baby',
                body: '• Bibigyan ka ng tableta ng iron na may Folic Acid at Calcium Carbonate. Bibigyan ka rin ng 2 iodine capsules na iinumin mo sa bahay, kung ikaw ay nasa ika-4 na buwan ng pagbubuntis.\n• Babakunahan ka laban sa tetano.\n• Papayuhan ka tungkol sa tamang nutrisyon at pagkain, malusog na pamumuhay, paggawa ng birth plan, pagpapasuso, at pagpaplano ng pamilya.'
            }
        ],
        readTime: '5 min read',
        icon: <BookmarkCheck size={22} />,
        colorClass: 'cat-prenatal',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '4',
        title: 'Ang Paglaki ni Baby sa Sinapupunan ni Nanay',
        category: 'Prenatal Care',
        description: 'Ito ang iyong buwanang patnubay sa paglaki ni baby sa loob ng iyong sinapupunan.',
        fullContent: [
            {
                heading: 'Gabay sa Paglaki ni Baby',
                body: 'Anuman ang iyong kainin o gawin ay maaaring makaapekto sa tamang paglaki at paghubog ni baby.'
            },
            {
                heading: '0–4 na Linggo',
                body: '• Ang sukat ni baby ay humigit-kumulang 2 millimetro ang haba.\n• Nagsisimula nang mahubog ang kanyang utak, gulugod, at mukha.\n• Iwasan ang mga gamot na makakaapekto sa kanya.\n• Maglaan ng oras upang tumingin sa magagandang larawan at tanawin, na nakakatulong sa positibong karanasan sa pagbubuntis.'
            },
            {
                heading: '4–8 na Linggo',
                body: '• Ang puso ay nagsisimula nang tumibok.\n• Iba’t ibang bahagi ng katawan ay nagsisimula nang mabuo.\n• Nagsisimula nang magkaroon ng hubog ang kanyang mukha, mata, at mga daliri sa kamay at paa.\n• Makinig sa kaaya-ayang musika.\n• Kumain ng iba’t ibang uri ng pagkain tulad ng karne, isda, dilaw at luntiang gulay, at prutas.\n• Anuman ang iyong kainin ay nagbibigay ng sustansya kay baby.\n• Huwag kumain nang higit sa nararapat upang maiwasan ang sobrang pagtaas ng timbang.'
            },
            {
                heading: '8–12 na Linggo',
                body: '• Ang mga pangunahing bahagi ng katawan ay nahubog na.\n• Ang ulo ay mas malaki kung ikukumpara sa katawan upang mabigyan ng puwang ang paglaki ng utak.\n• Mayroon nang baba, ilong, at talukap ng mata.\n• Nakalutang si baby sa tubig ng bahay-bata (amniotic fluid).\n• Huwag kalimutang uminom ng iron, Folic Acid, at Calcium Carbonate supplements.\n• Gumamit ng iodized salt sa pagluto.\n• Huwag kumain nang higit sa nararapat upang maiwasan ang sobrang pagtaas ng timbang.'
            }
        ],
        readTime: '6 min read',
        icon: <Baby size={22} />,
        colorClass: 'cat-prenatal',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '5',
        title: 'Mga Pamahiin at Katotohanan sa Pagbubuntis',
        category: 'Mental Health & Wellness',
        description: 'Huwag basta maniwala sa mga sabi-sabi tungkol sa pagbubuntis. Alamin ang totoo at kumonsulta sa mga health service providers.',
        fullContent: [
            {
                heading: 'Tandaan:',
                body: 'Huwag basta maniwala sa mga sabi-sabi tungkol sa pagbubuntis. Alamin ang totoo at kumonsulta sa mga health service providers.'
            },
            {
                heading: '1. Kasarian at Hormones',
                body: 'Sabi-sabi: Kapag ang leeg at singit ni nanay ay maitim habang buntis, siguradong lalaki ang anak.\n\nAng totoo: Ang pangingitim ng leeg, singit, at iba pang bahagi ng katawan ng buntis ay dahil sa mga hormones na nagbabago habang buntis. Hinahanda ng hormones ang katawan ng nanay para sa sanggol sa loob ng siyam (9) na buwan. Hindi ibig sabihin nito na lalaki ang magiging anak. Ugaliing maligo at maalaga sa katawan araw-araw.'
            },
            {
                heading: '2. Kambal na Saging',
                body: 'Sabi-sabi: Kapag kumain ng kambal na saging ang buntis, kambal din ang magiging anak.\n\nAng totoo: Ang kasarian at kung magiging kambal ang baby ay natutukoy agad sa sandaling magtagpo ang itlog ng babae at punlay ng lalaki. Ang pagkain ng kambal na saging ay hindi nakaaapekto dito. Ang saging, kambal man o hindi, ay mayaman sa potassium na nakatutulong sa normal na paggana ng puso, kidney, at iba pang organs ng ina.'
            },
            {
                heading: '3. Paglalagas ng Ngipin',
                body: 'Sabi-sabi: Naglalagas ang ngipin sa bawat pagbubuntis.\n\nAng totoo: Hindi ito totoo. Basta may sapat na calcium sa katawan, makukuha ng dinadalang sanggol ang kailangan mula sa buto ng nanay, hindi sa ngipin.\n\nKumain ng mga pagkaing sagana sa calcium tulad ng: Keso, Gatas, Sardinas, Okra, Orange, Avocado. Mahalaga ring pangalagaan ang ngipin habang buntis dahil ang pagdami ng hormones ay maaaring makaapekto sa kondisyon nito.'
            },
            {
                heading: '4. Pagdalaw sa May Sakit',
                body: 'Sabi-sabi: Bawal dumalaw sa may sakit o pumunta sa mga burol ang buntis.\n\nAng totoo: Ang lumang kasabihan na ito ay base sa praktikal na dahilan, hindi sa pamahiin. Kung pupunta sa ospital, iwasan ang mga lugar na maraming may sakit upang hindi mahawa. Sa burol o lamay, dahil maraming tao, mas mataas ang exposure sa mikrobyo.'
            },
            {
                heading: '5. Pakikipagtalik Habang Buntis',
                body: 'Sabi-sabi: Huwag makikipagtalik habang buntis — baka mabutas ang inunan!\n\nAng totoo: Walang katotohanan ito. Sa katunayan, ang buntis ay maaaring magkaroon ng mas mataas na libido dahil sa pagbabago ng hormones. Hindi aabot ang ari sa inunan. Siguraduhin lamang na magpa-check-up sa doktor para malaman ang mga dapat pag-ingatan.'
            },
            {
                heading: '6. Pagkain ng Marami',
                body: 'Sabi-sabi: Huwag kakain ng marami dahil baka lumaki nang masyado ang sanggol sa sinapupunan at mahirapan manganak.\n\nAng totoo: Habang nagbubuntis, ang sanggol ay umaasa sa katawan ng nanay para sa sapat na nutrisyon. Kung hindi kakain nang sapat ang buntis, malaki ang posibilidad na mababa ang timbang ng anak sa pagsilang. Ang tamang pagkain ay nakakatulong sa kalusugan ng nanay at ng sanggol.'
            }
        ],
        readTime: '8 min read',
        icon: <Brain size={22} />,
        colorClass: 'cat-mental',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '6',
        title: 'Labor and Delivery / Kaganapan sa Panganganak',
        category: 'Postpartum Care',
        description: 'Kumpletuhin ito sa tulong ng inyong doktor, nars, o midwife. Mahalaga ring magplano at itala ang mismong oras.',
        fullContent: [
            {
                heading: 'Mga Detalye ng Panganganak',
                body: 'Nagsimula akong makaramdam ng pananakit ng tiyan nang: (oras)\nOras ng Panganganak:\nPetsa ng Panganganak:\nUri ng Panganganak: (Normal / Caesarean)\nLugar ng Panganganak:\nAng nagpaanak sa akin ay si:'
            },
            {
                heading: 'Portograph / Pagsusuri Agad Pagkapanganak',
                body: '• Umiyak agad\n• Hindi umiyak agad\n• Normal ang paghinga\n• Malakas ang galaw\n• Matamlay / hindi gumagalaw\n• Si baby ay ibinigay agad sa akin para sa Unang Yakap / Skin-to-Skin Contact'
            },
            {
                heading: 'Pagpapasuso at Skin-to-Skin Contact',
                body: '• Nagsimulang sumuso si baby sa loob ng 30 minuto pagkapanganak (mas mainam kung sa loob ng isang oras)\n• Si baby ay kasama ko pagkapanganak\n• Nabakunahan ng BCG\n• Napabakunahan laban sa Hepa B\n• Nabigyan ng eyedrops\n• Na-ineksyunan ng Vitamin K\n• Naisagawa ang Newborn Screening (NBS) at Newborn Hearing Screening'
            },
            {
                heading: 'Mga Detalye ng Baby',
                body: 'Kasarian:\nHaba pagkapanganak:\nTimbang pagkapanganak:\nSukat ng ulo:'
            },
            {
                heading: 'Mga Paalala para sa Unang Oras Pagkapanganak',
                body: '• Siguraduhing ang sanggol ay ibibigay sa iyo agad pagkaluwal.\n• Tiyaking nakalapat ang sanggol sa iyong dibdib (balat-sa-balat / skin-to-skin contact) nang 1 oras para panatilihin ang tamang temperatura at paghinga.\n• Habang nakadapa si baby sa iyong dibdib, takpan ng kumot ang kanyang likod.\n• Simulan ang pagpapasuso sa unang oras ng pagkapanganak.\n• Siguraduhing walang ibang ipapakain o ipapatikim sa iyong bagong sanggol.\n• Sapat na ang gatas ng ina sa unang 6 na buwan ng buhay ni baby.\n• Ipagpatuloy ang pagpapasuso mula 6 na buwan pataas kasama ang tamang pagpapakain sa solid foods.'
            }
        ],
        readTime: '7 min read',
        icon: <Sparkles size={22} />,
        colorClass: 'cat-postpartum',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '7',
        title: 'Pagputol ng Umbilical Cord at Checklist sa Panganganak',
        category: 'Newborn Care',
        description: 'Nanay, alam mo ba na may malaking epekto ang timing ng pagputol ng umbilical cord?',
        fullContent: [
            {
                heading: 'Timing ng Pagputol ng Umbilical Cord',
                body: 'Nanay, alam mo ba na may malaking epekto ang timing ng pagputol ng umbilical cord na nagbibigkis sa inyo ni baby?\n\nKaraniwang pinuputol ang umbilical cord sa loob ng isang minuto pagkapanganak. Pero kung hihintayin ang 2–3 minuto matapos ang panganganak, hanggang tumigil ang daloy ng dugo mula sa inunan papunta sa sanggol, masisiguro na mas maraming iron ang makukuha ni baby hanggang 4 na buwan.'
            },
            {
                heading: 'Checklist sa Panganganak: Para kay Nanay',
                body: 'SIGURADUHING DALAHIN ANG NANAY BOOK!\n\n• Palda at blusa o maluwag na damit na may bukasan sa harapan\n• Mga panty at bra\n• Bathrobe, Tuwalya\n• Shampoo / sabon, Toilet paper\n• Sipilyo / toothpaste, Tsinelas\n• Pasador / sanitary napkin'
            },
            {
                heading: 'Checklist para sa Baby',
                body: '• Kumot ng bata, Damit ng bata\n• Lampin / Diaper, Sombrero / Bonnet\n• Supot sa kamay (Mittens), Medyas\n• Bib, Sabon na pang-baby, Cotton buds'
            },
            {
                heading: 'Para sa Pagpapaligo at Pangangalaga',
                body: '• Bimpong pampaligo, Paliguan / Palangganan\n• Malambot na tuwalya\n• Panapin na di nababasa (hal. rubber mat)\n• Crib / Kunan ng unan ng baby, Kulambo'
            }
        ],
        readTime: '6 min read',
        icon: <Baby size={22} />,
        colorClass: 'cat-newborn',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '8',
        title: 'PhilHealth at Panganganak',
        category: 'Prenatal Care',
        description: 'Alamin kung paano makatutulong ang PhilHealth sa iyong panganganak at ang mga benepisyong maaari mong makuha.',
        fullContent: [
            {
                heading: 'Paano makatutulong ang PhilHealth?',
                body: 'Ang PhilHealth ay tumutulong sa bawat Pilipino na magkaroon ng access sa serbisyong pangkalusugan.\n\n• Maternity Care Package: Babayaran hanggang P8,000 sa birthing homes o P6,500 sa ospital.\n• Cesarean Section Package: Babayaran hanggang P19,000.\n• Newborn Care Package: Babayaran hanggang P1,750.\n• Z Benefit Package: Para sa Prematurity at Low Birth Weight.'
            },
            {
                heading: 'PhilHealth Status at Pag-check',
                body: 'I-check agad ang status mo bilang miyembro:\n• Magtanong sa PhilHealth office ng inyong munisipyo o health center.\n• Kung miyembro ka na: Lumapit sa PhilHealth Regional Office o tumawag sa PhilHealth Call Center: (02) 441-7442.\n• Kung nasa ospital na, maaaring alamin ang status sa kanilang HCI Portal.'
            },
            {
                heading: 'Kung hindi ka pa miyembro:',
                body: '• Lumapit sa tanggapan ng DSWD para makapagpalista.\n• Kung nasa ospital na, tumungo sa social welfare unit para sa point-of-care mechanism.\n• Humingi ng tulong sa inyong Municipal Social Welfare and Development Officer para magpa-sponsor.'
            }
        ],
        readTime: '5 min read',
        icon: <HeartPulse size={22} />,
        colorClass: 'cat-prenatal',
        sources: [
            { name: 'PhilHealth', title: 'Official Website & Social Media Channels', url: 'https://www.philhealth.gov.ph' }
        ]
    },
    {
        id: '9',
        title: 'Paghahanda sa Eksklusibong Pagpapasuso ng Anak',
        category: 'Postpartum Care',
        description: 'Nanay, alam mo ba na ang pagpapasuso ng anak ay nakabubuti hindi lang para kay baby, kundi para rin sa iyo?',
        fullContent: [
            {
                heading: 'Ano ang Eksklusibong Pagpapasuso?',
                body: 'Ito ay nangangahulugang gatas ng ina lamang ang ibinibigay sa unang 6 na buwan — walang milk formula, juice, tubig, o bitamina na hindi inireseta ng doktor.'
            },
            {
                heading: 'Mga Benepisyo para kay Baby',
                body: '• Ligtas, malinis, at madaling tunawin.\n• Sapat na pagkain sa unang 6 na buwan.\n• Proteksyon laban sa sakit tulad ng pagtatae at ubo/sipon.\n• Mas malusog at matibay na katawan.'
            },
            {
                heading: 'Mga Benepisyo para sa Nanay',
                body: '• Libre ang gatas ng ina.\n• Nakatutulong sa paghahadlang sa agarang pagbuntis (Lactational Amenorrhea Method - LAM).\n• Nakatutulong sa pagpapatibay ng bonding.\n• Mabilis ang pagbalik ng likas na sukat ng katawan dahil sa pag-contract ng uterus.'
            }
        ],
        readTime: '6 min read',
        icon: <Heart size={22} />,
        colorClass: 'cat-postpartum',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '10',
        title: 'Pangangalaga sa Bagong Silang na Sanggol',
        category: 'Newborn Care',
        description: 'Mga payo sa tamang pag-aalaga sa sanggol pagkatapos isilang.',
        fullContent: [
            {
                heading: 'Checklist sa Pag-aalaga',
                body: '✅ Unang Yakap / Skin-to-Skin Contact: Iwasang malamigan ang sanggol sa pamamagitan ng paglalapat ng katawan ng ina at baby.\n✅ Kaligtasan at Kalinisan: Sabunin at hugasan ng mabuti ang mga kamay bago hawakan ang baby.\n✅ Pagpapaligo: Ipagpaliban ang pagpapaligo nang hindi bababa sa 6 na oras.\n✅ Pangangalaga sa Pusod: Hayaang walang takip at huwag lagyan ng anumang bagay. Kusang matatanggal makalipas ang 7–10 araw.\n✅ Kapaligiran: Panatilihing malayo ang baby sa usok.\n✅ Pagpapasuso: Pasususuhin ang baby nang madalas at matagal.'
            },
            {
                heading: 'Kailan dapat magpatingin sa Health Center?',
                body: 'Magpatingin agad kung mapansin ang mga ito:\n• Hirap o humina ang pagsuso\n• Masamang amoy sa pusod\n• Nilalagnat (Temperatura ≥ 37.8°C)\n• Naninigas o nagkakaroon ng kumbusyon\n• Mabilis o hirap sa paghinga\n• Naninilaw ang balat'
            }
        ],
        readTime: '5 min read',
        icon: <Baby size={22} />,
        colorClass: 'cat-newborn',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '11',
        title: 'Pangangalaga sa Ina Pagkatapos Manganak',
        category: 'Postpartum Care',
        description: 'Gabay sa kalusugan ng ina sa loob ng 42 araw pagkatapos manganak.',
        fullContent: [
            {
                heading: 'Sa loob ng 24 oras (Bago pauwiin)',
                body: 'Obserbahan ang mga "danger signs":\n• Mabigat o hirap sa paghinga\n• Pagdurugo o Lagnat\n• Labis na pananakit ng puson\n• Kombulsyon\n\nPayo sa: Nutrisyon, Family Planning, Pag-aalaga sa sanggol, at suporta sa pagpapasuso.'
            },
            {
                heading: 'Hanggang 7 Araw Pagkatapos Manganak',
                body: '• Pagsusuring pisikal at BP check.\n• Suriin ang pagdurugo.\n• Bigyan ng Iron/Folic Acid (3 buwan) at Vitamin A.\n• Magpaligo araw-araw at magpalit ng pasador tuwing 4–6 na oras.'
            },
            {
                heading: '8–42 Araw Pagkatapos Manganak',
                body: '• Patuloy na pagsusuring pisikal at pagmonitor.\n• Pagbibigay ng Iron/Folic Acid.\n• Payo sa nutrisyon at pagpaplano ng pamilya.\n• Dapat masuri ang ina nang 3 beses sa loob ng period na ito.'
            }
        ],
        readTime: '6 min read',
        icon: <Sparkles size={22} />,
        colorClass: 'cat-postpartum',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '12',
        title: 'Family Planning / Tamang Pagpaplano ng Pamilya',
        category: 'Postpartum Care',
        description: 'Alamin ang iba\'t ibang pamamaraan ng family planning para sa tamang pag-aagwat ng anak.',
        fullContent: [
            {
                heading: 'Natural Methods',
                body: '• Standard Days Method (Cycle Beads): Para sa regular cycle (26–32 days).\n• Lactational Amenorrhea Method (LAM): Para sa nagpapasuso (wala pang 6 months, wala pang regla).\n• Symptoms-Based Methods: Pagbabantay sa mucus at temperatura.'
            },
            {
                heading: 'Hormonal at Barrier Methods',
                body: '• Pills: Daily intake. (Progestin-only para sa nagpapasuso).\n• Condom: Proteksyon laban sa STIs.\n• Injectable: Kada 3 buwan.\n• Implant: Mabisa hanggang 3 taon.'
            },
            {
                heading: 'Long-term at Permanent Methods',
                body: '• IUD: Mabisa hanggang 12 taon.\n• BTL (Babae) at Vasectomy (Lalaki): Permanenteng pamamaraan para sa mga ayaw na ng anak.'
            }
        ],
        readTime: '8 min read',
        icon: <Heart size={22} />,
        colorClass: 'cat-postpartum',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '13',
        title: 'Timeline ng Pangangalaga sa Sanggol',
        category: 'Newborn Care',
        description: 'Gabay sa mga dapat gawin para kay baby mula 24 oras hanggang 4 na linggo.',
        fullContent: [
            {
                heading: 'Sa loob ng 24 oras',
                body: '• Skin-to-Skin Contact.\n• Kaagad na pagpapasuso.'
            },
            {
                heading: 'Unang Linggo (2–3 araw)',
                body: '• Pag-eksamin sa sanggol at pag-alaga sa pusod.\n• Gatas ng ina lamang.\n• Weight check, Newborn Screening, at Hearing Screening.\n• Vitamin K, BCG, at Hepa B vaccination.'
            },
            {
                heading: '2–4 na Linggo',
                body: '• Patuloy na pag-eksamin at weight check.\n• Eksklusibong pagpapasuso.'
            },
            {
                heading: 'Mga Palatandaan na dapat Agad Ipa-check',
                body: '• Di sumuso o ayaw sumuso\n• Paninigas o kumbulsyon\n• Lagnat o nanlalamig\n• Namamaga ang pusod o may nana/dugo\n• Naninilaw ang balat o mata\n• Di kumikilos o matamlay'
            }
        ],
        readTime: '6 min read',
        icon: <Baby size={22} />,
        colorClass: 'cat-newborn',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '14',
        title: 'Mga Pangangailangan ni Baby sa Unang Linggo',
        category: 'Newborn Care',
        description: 'Panatilihing ligtas, mainit, at malusog ang iyong bagong silang na sanggol.',
        fullContent: [
            {
                heading: 'Init at Pagmamahal',
                body: '• Panatilihin ang init gamit ang skin-to-skin contact.\n• Balutin sa kumot para hindi malamigan.\n• Panatilihin si baby sa tabi mo; nasisiyahan siya sa iyong bisig.'
            },
            {
                heading: 'Wastong Pagkain',
                body: '• Gatas ng ina lamang hanggang 6 na buwan.\n• Huwag painumin ng tubig o ibang gatas.\n• Hayaang kusang sumuso hangga’t gusto niya.'
            },
            {
                heading: 'Proteksyon at Suporta',
                body: '• Eye drops para maiwasan ang impeksyon.\n• Bakuna laban sa Hepatitis B at BCG.\n• Kumonsulta sa breastfeeding counselors kung nahihirapan.'
            }
        ],
        readTime: '5 min read',
        icon: <Baby size={22} />,
        colorClass: 'cat-newborn',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '15',
        title: 'Mga Kaganapan sa Paglaki ng Sanggol',
        category: 'Newborn Care',
        description: 'Tingnan ang mga milestones ni baby sa ika-4 at ika-8 buwan.',
        fullContent: [
            {
                heading: '4 na Buwan',
                body: '• Kinagigiliwang tingnan ang mga kulay.\n• Susundan ng mga mata ang gumagalaw na bagay.\n• Nagsisimula nang ngumiti, mag-gurgling, at tumugon sa boses/mukha ng magulang.\n• Pakitaan ng matitingkad na bagay, kausapin, at bigyan ng lugar para makaunat.'
            },
            {
                heading: '8 na Buwan',
                body: '• Nakakaikot na at nakaupo nang maayos; tuwid na ang ulo.\n• Kaya nang abutihin ang mga bagay at isubo sa bibig.\n• Nakikita na ang mga tao at bagay sa paligid.\n• Hayaang hawakan ng ibang pamilya para matuto siyang makipag-interact.\n• Bigyan ng malinis, ligtas, at makukulay na laruan.'
            }
        ],
        readTime: '4 min read',
        icon: <Star size={22} />,
        colorClass: 'cat-newborn',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '16',
        title: 'Mga Simpleng Gabay Para Matiyak ang Kaligtasan ni Baby',
        category: 'Newborn Care',
        description: 'Mahalaga ang masusing pag-iingat upang maiwasan ang aksidente o panganib sa buhay.',
        fullContent: [
            {
                heading: 'Mga Paalala sa Araw-araw',
                body: '• Huwag pabayaan si baby na mag-isa.\n• Patulugin sa kuna (iwasang mahulog) at patulugin nang pahilig o patagilid.\n• Huwag ihagis pataas o paikut-ikutin.\n• Huwag pabayaang maligo nang mag-isa (hanggang 6 yrs old).\n• Ilayo sa usok at naninigarilyo.'
            },
            {
                heading: 'Itago ang Mapanganib na Bagay',
                body: '• Posporo, kandila, mainit na tubig/sabaw.\n• Gas, insecticide, kemikal.\n• Maliit at matutulis na bagay.\n• Plastic bags (iwas-saklaw sa ulo).\n• Kawad at saksakan ng kuryente.'
            },
            {
                heading: 'Ligtas na Kapaligiran',
                body: '• Huwag mag-iwan ng timba o palanggana na may tubig.\n• Isusi ang cabinets/drawers at lagyan ng harang ang kama.\n• Huwag hayaang maglaro sa kalsada.\n• Laging gamitan ng seatbelt at huwag iwan sa loob ng sasakyan.\n• Bantayan malapit sa swimming pool, ilog, o sapa.'
            }
        ],
        readTime: '6 min read',
        icon: <ShieldCheck size={22} />,
        colorClass: 'cat-newborn',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '17',
        title: 'Tagubilin sa Pagpapakain ng Baby',
        category: 'Newborn Care',
        description: 'Wastong gabay sa pagpapakain mula 0 hanggang 12 buwan.',
        fullContent: [
            {
                heading: '0 hanggang 6 na Buwan',
                body: '• Tanging gatas ng ina lamang (walang tubig o ibang pagkain).\n• Pasususuhin hangga’t gusto niya (humigit-kumulang 15 mins bawat session).'
            },
            {
                heading: '6 hanggang 12 Buwan',
                body: '• Patuloy ang pagpapasuso.\n• Bigyan ng karagdagang pagkain na may sapat na enerhiya (dagdagan ng konting mantika).\n• Mga Halimbawa: Dinurog na gulay, monggo, patatas, tinadtad na karne, isda, pula ng itlog, at prutas (saging, mangga, abokado).'
            },
            {
                heading: 'Schedule ng Pagkain',
                body: '• Magsimula sa 1–2 beses bawat araw pagkatapos sumuso, paakyatin sa 3 beses.\n• Magbigay din ng masustansyang meryenda tulad ng taho.'
            }
        ],
        readTime: '5 min read',
        icon: <Apple size={22} />,
        colorClass: 'cat-nutrition',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    },
    {
        id: '18',
        title: 'Pagsubaybay sa Paglaki at Pagbabago ni Baby',
        category: 'Newborn Care',
        description: 'Regular na pagtitimbang at pag-monitor sa growth chart ni baby.',
        fullContent: [
            {
                heading: 'Pagtitimbang at Pag-monitor',
                body: '• Buwan-buwan mula pagsilang hanggang 2 taon.\n• Tuwing ika-3 buwan mula 2 taon hanggang 6 na taon.\n• Itala ang timbang sa Growth Chart upang makita ang pagtaas o pagbaba nito.'
            },
            {
                heading: 'Paggamit ng Growth Chart',
                body: '• Dito makikita ang mga mahahalagang milestones sa paglaki.\n• Ang bawat pangyayari ay may simbolo upang mas madaling masundan ang kalusugan ni baby.'
            }
        ],
        readTime: '4 min read',
        icon: <BookmarkCheck size={22} />,
        colorClass: 'cat-newborn',
        sources: [
            { name: 'DOH Philippines', title: 'Booklet of Healthy Buntis, Happy Baby', url: 'https://doh.gov.ph' }
        ]
    }
];

const CATEGORIES = [
    'All',
    'Nutrition',
    'Mental Health & Wellness',
    'Prenatal Care',
    'Postpartum Care',
    'Newborn Care',
];

const CAT_ICONS = {
    'Nutrition': <Apple size={14} />,
    'Mental Health & Wellness': <Brain size={14} />,
    'Prenatal Care': <HeartPulse size={14} />,
    'Postpartum Care': <Heart size={14} />,
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
            {!isActiveFiler && tipOfTheDay && (
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
                        placeholder="Maghanap: 'bakuna', 'nutrisyon', 'panganganak'…"
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
