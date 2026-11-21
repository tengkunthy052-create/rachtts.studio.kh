import { VoiceOption, StyleOption, DialogueTurn } from '../types';

export const VOICES: VoiceOption[] = [
  {
    id: 'Kore',
    gender: 'female',
    nameKh: 'កូរ៉េ (Kore)',
    nameEn: 'Female • Warm & Natural',
    descKh: 'សំឡេងស្រីស្រទន់ ពិរោះ រលូន ស័ក្តិសមសម្រាប់អានអត្ថបទ រឿងនិទាន និងព័ត៌មានទូទៅ',
    badge: 'ពេញនិយមបំផុត',
    avatarColor: 'from-rose-500 to-pink-600',
  },
  {
    id: 'Zephyr',
    gender: 'female',
    nameKh: 'សេហ្វៀ (Zephyr)',
    nameEn: 'Female • Bright & Clear',
    descKh: 'សំឡេងស្រីស្រស់ថ្លា រស់រវើក យុវវ័យ ស័ក្តិសមសម្រាប់ស្វាគមន៍ ការផ្សាយពាណិជ្ជកម្ម និងវីដេអូខ្លី',
    badge: 'ស្រស់ថ្លា',
    avatarColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 'Puck',
    gender: 'male',
    nameKh: 'ផាក់ (Puck)',
    nameEn: 'Male • Clear & Energetic',
    descKh: 'សំឡេងប្រុសច្បាស់ មានថាមពល និងភាពជឿជាក់ ល្អសម្រាប់អានព័ត៌មាន ការបង្រៀន និងបទបង្ហាញ',
    badge: 'ពេញនិយមបំផុត',
    avatarColor: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'Charon',
    gender: 'male',
    nameKh: 'ការ៉ុន (Charon)',
    nameEn: 'Male • Deep & Calm',
    descKh: 'សំឡេងប្រុសជ្រៅ ទន់ភ្លន់ សុភាពរាបសារ និងស្ងប់ស្ងាត់ ល្អសម្រាប់រឿងនិទានយប់ និងសម្រង់គំនិត',
    badge: 'សុភាព',
    avatarColor: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'Fenrir',
    gender: 'male',
    nameKh: 'ហ្វេនរីរ (Fenrir)',
    nameEn: 'Male • Resonant Broadcaster',
    descKh: 'សំឡេងប្រុសផ្លូវការ ដូចពិធីករវិទ្យុ និងទូរទស្សន៍អាជីព មានកិត្យានុភាពខ្ពស់',
    badge: 'ផ្លូវការ',
    avatarColor: 'from-purple-500 to-violet-600',
  },
  {
    id: 'Orus',
    gender: 'male',
    nameKh: 'អូរឹស (Orus) • អ្នកវិភាគ',
    nameEn: 'Male • Firm & Analytical',
    descKh: 'សំឡេងប្រុសម៉ឺងម៉ាត់ មានទម្ងន់ និងហេតុផលច្បាស់លាស់ ស័ក្តិសមបំផុតសម្រាប់វិភាគសេដ្ឋកិច្ច នយោបាយ និងបច្ចេកវិទ្យា',
    badge: 'អ្នកវិភាគ',
    avatarColor: 'from-cyan-500 to-blue-700',
    recommendedStyle: 'analyst',
  },
  {
    id: 'Aoede',
    gender: 'female',
    nameKh: 'អាអូដេ (Aoede) • Podcast',
    nameEn: 'Female • Warm Podcast Host',
    descKh: 'សំឡេងស្រីកក់ក្តៅ ស្និទ្ធស្នាល មានចង្វាក់រស់រវើកបែបស្ទូឌីយោ ស័ក្តិសមបំផុតសម្រាប់កម្មវិធី Podcast និង Talk Show',
    badge: 'Podcast',
    avatarColor: 'from-fuchsia-500 to-purple-600',
    recommendedStyle: 'podcast',
  },
  {
    id: 'Gacrux',
    gender: 'female',
    nameKh: 'ហ្គាគ្រុស (Gacrux) • អ្នកវិភាគស្រី',
    nameEn: 'Female • Mature & Insightful',
    descKh: 'សំឡេងស្រីចាស់ទុំ ស្ងប់ស្ងាត់ មានកិត្យានុភាព ស័ក្តិសមសម្រាប់វិភាគស៊ីជម្រៅ ឯកសារស្រាវជ្រាវ និង Podcast អប់រំ',
    badge: 'អ្នកវិភាគ',
    avatarColor: 'from-teal-500 to-emerald-700',
    recommendedStyle: 'analyst',
  },
  {
    id: 'Schedar',
    gender: 'male',
    nameKh: 'ស្ឆេដា (Schedar) • Podcast',
    nameEn: 'Male • Smooth Podcast Host',
    descKh: 'សំឡេងប្រុសរលូន កក់ក្តៅ ស្និទ្ធស្នាលបែបសន្ទនា ស័ក្តិសមបំផុតសម្រាប់ Podcast ប្រវត្តិសាស្ត្រ ជំនួញ និងការចែករំលែកគំនិត',
    badge: 'Podcast',
    avatarColor: 'from-indigo-500 to-violet-700',
    recommendedStyle: 'podcast',
  },
  {
    id: 'Leda',
    gender: 'female',
    nameKh: 'លេដា (Leda) • ផ្សព្វផ្សាយ/ទីផ្សារ',
    nameEn: 'Female • Youthful Promo & Ads',
    descKh: 'សំឡេងស្រីយុវវ័យ ស្រស់ស្រាយ រស់រវើក និងទាក់ទាញ ស័ក្តិសមបំផុតសម្រាប់វីដេអូផ្សាយពាណិជ្ជកម្ម TikTok/Reels និងលក់ផលិតផល',
    badge: 'ទីផ្សារ',
    avatarColor: 'from-pink-500 to-rose-600',
    recommendedStyle: 'marketing',
  },
  {
    id: 'Alnilam',
    gender: 'male',
    nameKh: 'អាល់នីឡាម (Alnilam) • ពាណិជ្ជកម្ម',
    nameEn: 'Male • Energetic Commercial Ad',
    descKh: 'សំឡេងប្រុសមានថាមពល ឮច្បាស់ ជឿជាក់ និងបញ្ចុះបញ្ចូលខ្ពស់ ស័ក្តិសមបំផុតសម្រាប់ផ្សាយប្រូម៉ូសិន អចលនទ្រព្យ និងបច្ចេកវិទ្យា',
    badge: 'ទីផ្សារ',
    avatarColor: 'from-orange-500 to-red-600',
    recommendedStyle: 'marketing',
  },
  {
    id: 'Sulafat',
    gender: 'female',
    nameKh: 'ស៊ូឡាហ្វាត (Sulafat) • ផ្សព្វផ្សាយម៉ាក',
    nameEn: 'Female • Warm Brand Marketing',
    descKh: 'សំឡេងស្រីកក់ក្តៅ ទុកចិត្តបាន និងបញ្ចុះបញ្ចូល ស័ក្តិសមសម្រាប់ផ្សព្វផ្សាយម៉ាកយីហោ សេវាកម្ម និងយុទ្ធនាការទីផ្សារ',
    badge: 'ទីផ្សារ',
    avatarColor: 'from-violet-500 to-fuchsia-600',
    recommendedStyle: 'marketing',
  },
];

export const STYLES: StyleOption[] = [
  {
    id: 'natural',
    labelKh: 'ធម្មតា និងធម្មជាតិ',
    labelEn: 'Natural & Conversational',
    descKh: 'សំឡេងនិយាយធម្មតាក្នុងជីវិតប្រចាំថ្ងៃ ស្រួលស្តាប់',
    icon: 'Sparkles',
  },
  {
    id: 'marketing',
    labelKh: 'ផ្សព្វផ្សាយ និងទីផ្សារ (Promo)',
    labelEn: 'Commercial & Marketing Ads',
    descKh: 'សំឡេងរស់រវើក មានថាមពល ទាក់ទាញចិត្តអតិថិជន សម្រាប់ផ្សាយពាណិជ្ជកម្ម និងប្រូម៉ូសិន',
    icon: 'Megaphone',
  },
  {
    id: 'podcast',
    labelKh: 'បែប Podcast (ពិធីករ)',
    labelEn: 'Podcast Host & Studio',
    descKh: 'សំឡេងស្និទ្ធស្នាល ជិតមីក្រូហ្វូនស្ទូឌីយោ រស់រវើក ដូចកម្មវិធីផតខាសអាជីព',
    icon: 'Headphones',
  },
  {
    id: 'analyst',
    labelKh: 'បែបអ្នកវិភាគ (Analyst)',
    labelEn: 'Deep Analyst & Commentary',
    descKh: 'សំឡេងវិភាគស៊ីជម្រៅ មានទម្ងន់ ហេតុផលច្បាស់ សម្រាប់វិភាគសេដ្ឋកិច្ច ឬភូមិសាស្ត្រនយោបាយ',
    icon: 'TrendingUp',
  },
  {
    id: 'news',
    labelKh: 'ព័ត៌មាន និងផ្លូវការ',
    labelEn: 'News Broadcaster',
    descKh: 'សំឡេងច្បាស់ ចង្វាក់ស្មើ ដូចពិធីករព័ត៌មានទូរទស្សន៍',
    icon: 'Radio',
  },
  {
    id: 'story',
    labelKh: 'រឿងនិទាន និងមនោសញ្ចេតនា',
    labelEn: 'Storytelling',
    descKh: 'សំឡេងរស់រវើក មានទឹកដម និងអារម្មណ៍កក់ក្តៅ',
    icon: 'BookOpen',
  },
  {
    id: 'cheerful',
    labelKh: 'រីករាយ និងស្វាហាប់',
    labelEn: 'Cheerful & Upbeat',
    descKh: 'សំឡេងស្រស់ស្រាយ ញញឹម ពេញដោយភាពរួសរាយ',
    icon: 'Smile',
  },
  {
    id: 'calm',
    labelKh: 'ស្ងប់ស្ងាត់ និងស្រទន់',
    labelEn: 'Calm & Soothing',
    descKh: 'សំឡេងថ្នមៗ ស្រទន់ ជួយឱ្យអារម្មណ៍ស្រស់ស្រាយ',
    icon: 'Feather',
  },
  {
    id: 'formal',
    labelKh: 'រាជការ និងគារវកិច្ច',
    labelEn: 'Formal & Polite',
    descKh: 'សំឡេងសុភាព សម្តែងការគោរព និងគួរសមខ្ពស់',
    icon: 'ShieldCheck',
  },
];

export const SAMPLE_TEXTS = [
  {
    language: 'km' as const,
    title: '⚡ ព័ត៌មានបច្ចេកវិទ្យា (ខ្លី ~30s)',
    category: 'ព័ត៌មាន',
    text: 'ព្រះរាជាណាចក្រកម្ពុជា កំពុងបន្តបោះជំហានយ៉ាងសកម្មក្នុងការអភិវឌ្ឍវិស័យបច្ចេកវិទ្យាឌីជីថល និងបញ្ញាសិប្បនិម្មិត ក្នុងគោលដៅជំរុញកំណើនសេដ្ឋកិច្ចជាតិ និងបង្កើនប្រសិទ្ធភាពក្នុងការរស់នៅរបស់ប្រជាពលរដ្ឋ។',
    recommendedVoice: 'Puck',
    recommendedStyle: 'news' as const,
  },
  {
    language: 'km' as const,
    title: '🏰 ទេសចរណ៍អង្គរវត្ត (~1 នាទី)',
    category: 'ទេសចរណ៍',
    text: 'សូមស្វាគមន៍មកកាន់ទឹកដីខេត្តសៀមរាប អង្គរ! ប្រាសាទអង្គរវត្ត គឺជាបេះដូង និងជាមោទនភាពដ៏អស្ចារ្យបំផុតនៃប្រជាជាតិខ្មែរ ដែលបានទាក់ទាញភ្ញៀវទេសចរជាតិ និងអន្តរជាតិរាប់លាននាក់ឱ្យមកទស្សនាអច្ឆរិយវត្ថុនៃពិភពលោកមួយនេះ។ ស្នាដៃស្ថាបត្យកម្មដ៏ល្អវិចិត្រ រួមជាមួយចម្លាក់ក្បាច់ក្បូរដ៏រស់រវើក បានបង្ហាញពីភាពរុងរឿងនៃអរិយធម៌អង្គរនាសម័យបុរាណ។',
    recommendedVoice: 'Kore',
    recommendedStyle: 'natural' as const,
  },
  {
    language: 'km' as const,
    title: '📖 អត្ថបទវែង ១៥ នាទី (~16,000 តួអក្សរ)',
    category: 'ប្រវត្តិសាស្ត្រ & អរិយធម៌',
    text: `ប្រវត្តិសាស្ត្រនៃព្រះរាជាណាចក្រកម្ពុជា មានឫសគល់យ៉ាងជ្រៅតាំងពីរាប់ពាន់ឆ្នាំមុន ដែលជាអរិយធម៌ដ៏ចំណាស់ និងរុងរឿងបំផុតមួយនៅតំបន់អាស៊ីអាគ្នេយ៍។ ចក្រភពអង្គរ ដែលបានកកើតឡើងនៅចន្លោះសតវត្សទី ៩ ដល់ទី ១៥ គឺជាសម័យកាលដ៏មហស្ចារ្យ នៃស្ថាបត្យកម្ម វិស្វកម្មធារាសាស្ត្រ និងវប្បធម៌ខ្មែរ។

ប្រាសាទអង្គរវត្ត ដែលបានកសាងឡើងដោយព្រះបាទសូរ្យវរ្ម័នទី ២ ឧទ្ទិសថ្វាយដល់ព្រះវិស្ណុ គឺជាសំណង់សាសនាដ៏ធំបំផុតលើពិភពលោក។ ប្រាសាទនេះមិនត្រឹមតែបង្ហាញពីជំនាញសិល្បៈដ៏ប៉ិនប្រសប់របស់បុព្វបុរសខ្មែរប៉ុណ្ណោះទេ ប៉ុន្តែថែមទាំងជាសក្ខីភាពបញ្ជាក់ពីចំណេះដឹងតារាសាស្ត្រ ធរណីមាត្រ និងការគ្រប់គ្រងទឹកដ៏អស្ចារ្យ។

ក្រៅពីអង្គរវត្ត ប្រាសាទបាយ័ននៅរាជធានីអង្គរធំ ដែលត្រូវបានកសាងឡើងដោយព្រះបាទជ័យវរ្ម័នទី ៧ ក៏មានលក្ខណៈពិសេសអស្ចារ្យដោយមានរូបព្រហ្មមុខបួនញញឹមពព្រាយ តំណាងឱ្យព្រហ្មវិហារធម៌ទាំងបួនគឺ មេត្តា ករុណា មុទិតា និងឧបេក្ខា។ ព្រះបាទជ័យវរ្ម័នទី ៧ ក៏ជាមហាក្សត្រដែលបានកសាងមន្ទីរពេទ្យ (អរោគ្យសាលា) ចំនួន ១០២ និងផ្ទះសំណាក់មានភ្លើង (ធម្មសាលា) ១២១ កន្លែងពាសពេញផ្ទៃប្រទេស។

ប្រព័ន្ធធារាសាស្ត្របុរាណខ្មែរ ដូចជា បារាយណ៍ខាងលិច និងបារាយណ៍ខាងកើត អាចស្តុកទឹកបានរាប់សិបលានម៉ែត្រគូប សម្រាប់ផ្គត់ផ្គង់កសិកម្មបានពេញមួយឆ្នាំ ដែលជាកត្តាសំខាន់បំផុតធ្វើឱ្យចក្រភពអង្គរមានស្ថិរភាពស្បៀងអាហារ និងទ្រទ្រង់ប្រជាជនរាប់សែននាក់យ៉ាងសុខក្សេមក្សាន្ត។

បេតិកភណ្ឌអរូបីរបស់ខ្មែរ ដូចជា របាំព្រះរាជទ្រព្យ ល្ខោនខោល តន្ត្រីពិណពាទ្យ និងក្បាច់គុនល្បុក្កតោ ក៏ត្រូវបានអង្គការយូណេស្កូ (UNESCO) ចុះបញ្ជីជាបេតិកភណ្ឌវប្បធម៌អរូបីនៃមនុស្សជាតិផងដែរ។ នេះបញ្ជាក់ឱ្យឃើញច្បាស់អំពីតម្លៃសកល និងភាពសម្បូរបែបនៃព្រលឹងវប្បធម៌ដូនតាខ្មែរ។

នៅក្នុងយុគសម័យទំនើបនេះ កម្ពុជាបាននឹងកំពុងបន្តខិតខំអភិរក្សបេតិកភណ្ឌវប្បធម៌ដ៏មានតម្លៃមិនអាចកាត់ថ្លៃបានទាំងនេះ ព្រមទាំងបោះជំហានយ៉ាងស្វាហាប់ឆ្ពោះទៅកាន់ការអភិវឌ្ឍសេដ្ឋកិច្ច ឌីជីថល និងបច្ចេកវិទ្យាថ្មីៗ ដើម្បីកសាងអនាគតដ៏រុងរឿងជូនកូនចៅខ្មែរជំនាន់ក្រោយ។`,
    recommendedVoice: 'Charon',
    recommendedStyle: 'story' as const,
  },
  {
    language: 'km' as const,
    title: '📚 រឿងនិទានពេញលេញ ៣០ នាទី (រឿងព្រេងប្រជាប្រិយ)',
    category: 'រឿងនិទាន',
    text: `កាលពីព្រេងនាយ មានសត្វទន្សាយមួយក្បាលរស់នៅក្នុងព្រៃជ្រៅដ៏ស្រស់បំព្រង។ ទន្សាយនោះមានបញ្ញាឈ្លាសវៃ តែងតែជួយដោះស្រាយវិវាទ និងផ្តល់យុត្តិធម៌ដល់សត្វទាំងឡាយក្នុងព្រៃ ដោយហេតុនេះហើយទើបសត្វទាំងពួងប្រសិទ្ធនាមឱ្យថា "សុភាទន្សាយ"។

ថ្ងៃមួយ មានបុរសកសិករម្នាក់បានដើរចូលទៅក្នុងព្រៃដើម្បីកាប់ឈើធ្វើផ្ទះ។ ពេលដើរដល់គុម្ពព្រៃមួយ គាត់ស្រាប់តែបានឮសំឡេងស្រែកថ្ងូរយ៉ាងវេទនា។ លុះដើរទៅជិត គាត់ឃើញសត្វខ្លាធំមួយក្បាលបានជាប់ក្នុងអន្ទាក់ព្រានព្រៃយ៉ាងណែន មិនអាចរើខ្លួនរួចឡើយ។

ឃើញកសិករដើរមកជិត ខ្លាក៏បានអង្វរករដោយទឹកមុខក្រៀមក្រំថា៖ "ឱលោកបងកសិករអើយ! សូមមេត្តាជួយដោះលែងខ្ញុំផងចុះ! ប្រសិនបើលោកបងជួយខ្ញុំឱ្យរួចជីវិត ខ្ញុំសន្យាថានឹងតបស្នងសគុណលោកបងយ៉ាងធំធេង ហើយនឹងមិនធ្វើបាបមនុស្សលោកឡើយ!"

កសិករជាមនុស្សស្លូតបូត មានចិត្តអាណិតអាសូរ ក៏យល់ព្រមជួយដោះលែងខ្លាចេញពីអន្ទាក់។ ប៉ុន្តែ ពេលខ្លារួចខ្លួនភ្លាម ធម្មជាតិជាសត្វសាហាវរបស់វាក៏បានលេចឡើង។ ខ្លាបានគ្រហឹមយ៉ាងខ្លាំង ហើយនិយាយទៅកាន់កសិករថា៖ "ខ្ញុំបានអត់អាហារជាច្រើនថ្ងៃមកហើយ ឃ្លានខ្លាំងណាស់ ឥឡូវនេះខ្ញុំត្រូវតែស៊ីលោកឯងដើម្បីបំបាត់ការស្រេកឃ្លាន!"

កសិករស្លុតរន្ធត់ចិត្តជាខ្លាំង ក៏បានតវ៉ាថា៖ "ហេតុអ្វីបានជាឯងក្បត់ពាក្យសន្យាបែបនេះ? ខ្ញុំជាអ្នកជួយសង្គ្រោះជីវិតឯង ឯងមិនត្រូវតបស្នងដោយអំពើអាក្រក់នោះទេ!"

ពេលនោះ សុភាទន្សាយបានដើរកាត់ទីនោះល្មម។ ឮការប្រកែកគ្នា ទន្សាយក៏ចូលមកសួរនាំដំណើររឿង។ ក្រោយពីបានស្តាប់ការរៀបរាប់របស់ភាគីទាំងពីរ ទន្សាយធ្វើជាមិនទាន់យល់ច្បាស់ ហើយនិយាយថា៖ "រឿងនេះពិបាកវិនិច្ឆ័យណាស់ ព្រោះខ្ញុំមិនបានឃើញហេតុការណ៍ពីដំបូង។ ដើម្បីឱ្យដឹងពិតប្រាកដ សូមអ្នកទាំងពីរសម្តែងកាយវិការឡើងវិញ តើខ្លាជាប់អន្ទាក់របៀបណា ហើយកសិករជួយដោយរបៀបណា?"

ខ្លាដោយសារតែអំនួត និងល្ងង់ខ្លៅ ក៏បានដើរចូលទៅក្នុងរង្វង់អន្ទាក់វិញ ហើយឱ្យកសិករចងខ្សែដូចដើម។ ពេលខ្លាជាប់ក្នុងអន្ទាក់យ៉ាងណែនវិញ ទន្សាយក៏បានងាកទៅប្រាប់កសិករថា៖ "ឥឡូវនេះ ខ្លាបានជាប់អន្ទាក់ដូចកាលពីមុនហើយ។ ចូរលោកបងដើរចេញទៅចុះ កុំជួយសត្វតិរច្ឆានដែលគ្មានកតញ្ញូតាធម៌បែបនេះទៀតឱ្យសោះ!"

កសិករបានថ្លែងអំណរគុណដល់សុភាទន្សាយយ៉ាងជ្រាលជ្រៅ ហើយបានធ្វើដំណើរត្រឡប់ទៅផ្ទះវិញដោយសុវត្ថិភាព។ រឿងនិទាននេះបានអប់រំយើងថា៖ បញ្ញា និងសេចក្តីស្មោះត្រង់ តែងតែយកឈ្នះលើកម្លាំងបាយ និងភាពក្បត់ជានិច្ច។`,
    recommendedVoice: 'Charon',
    recommendedStyle: 'story' as const,
  },
  {
    language: 'km' as const,
    title: '📊 វិភាគសេដ្ឋកិច្ច & AI (អ្នកវិភាគ)',
    category: 'អ្នកវិភាគ',
    text: 'បើក្រឡេកមើលនិន្នាការសេដ្ឋកិច្ចឌីជីថលក្នុងឆ្នាំនេះ កត្តាគន្លឹះបីយ៉ាងដែលកំពុងផ្លាស់ប្តូរទីផ្សារការងារ គឺការប្រើប្រាស់បញ្ញាសិប្បនិម្មិតក្នុងអាជីវកម្ម ការពង្រឹងជំនាញធនធានមនុស្ស និងការកាត់បន្ថយចំណាយប្រតិបត្តិការ។ សហគ្រាសដែលសម្របខ្លួនបានលឿន នឹងទទួលបានប្រៀបខ្លាំងក្នុងការប្រកួតប្រជែងរយៈពេលវែង។',
    recommendedVoice: 'Orus',
    recommendedStyle: 'analyst' as const,
  },
  {
    language: 'km' as const,
    title: '🎧 បើកឆាក Podcast ជំនួញ (Podcast)',
    category: 'Podcast',
    text: 'សួស្តីប្រិយមិត្តអ្នកស្តាប់ទាំងអស់! សូមស្វាគមន៍មកកាន់កម្មវិធី Podcast ប្រចាំសប្តាហ៍របស់យើង។ ថ្ងៃនេះ យើងនឹងជជែកគ្នាស៊ីជម្រៅអំពីវិធីកសាងទម្លាប់ល្អៗ និងការគ្រប់គ្រងពេលវេលាប្រកបដោយប្រសិទ្ធភាព សម្រាប់អ្នកធ្វើការ និងម្ចាស់អាជីវកម្មជំនាន់ថ្មី។',
    recommendedVoice: 'Aoede',
    recommendedStyle: 'podcast' as const,
  },
  {
    language: 'km' as const,
    title: '📣 ស្ពតផ្សព្វផ្សាយលក់ផលិតផល (ទីផ្សារ)',
    category: 'ទីផ្សារ',
    text: 'ឱកាសពិសេសប្រចាំខែបានមកដល់ហើយ! ជាវផលិតផលថែរក្សាស្បែកធម្មជាតិថ្ងៃនេះ ទទួលបានការបញ្ចុះតម្លៃភ្លាមៗ ៣០ ភាគរយ រួមជាមួយការដឹកជញ្ជូនឥតគិតថ្លៃទូទាំងប្រទេស! កុំឱ្យឱកាសល្អនេះកន្លងផុតទៅឱ្យសោះ សូមទំនាក់ទំនងកុម្ម៉ង់ទិញឥឡូវនេះ!',
    recommendedVoice: 'Leda',
    recommendedStyle: 'marketing' as const,
  },
  {
    language: 'en' as const,
    title: '🇺🇸 English News & Business (~20s)',
    category: 'English News',
    text: 'Good morning and welcome to today’s technology briefing. Artificial intelligence and digital innovation continue to transform how businesses communicate across Southeast Asia, creating faster workflows, smarter tools, and new opportunities for creators worldwide.',
    recommendedVoice: 'Fenrir',
    recommendedStyle: 'news' as const,
  },
  {
    language: 'en' as const,
    title: '📣 Product Launch Promo (English Ads)',
    category: 'English Marketing',
    text: 'Ready to upgrade your daily workflow? Introducing the smartest way to create studio-quality audio in seconds! Try it today with our exclusive launch offer and experience crystal-clear sound built for modern creators and growing brands.',
    recommendedVoice: 'Alnilam',
    recommendedStyle: 'marketing' as const,
  },
  {
    language: 'en' as const,
    title: '📊 Global Market Analyst (English)',
    category: 'English Analyst',
    text: 'Looking closely at this quarter’s macroeconomic shift, three structural drivers stand out: capital reallocation into clean infrastructure, rapid automation across mid-sized enterprises, and rising demand for localized digital services across emerging Asian markets.',
    recommendedVoice: 'Orus',
    recommendedStyle: 'analyst' as const,
  },
  {
    language: 'en' as const,
    title: '🎙️ English Motivation & Podcast',
    category: 'English Podcast',
    text: 'Welcome back to the studio! Every great achievement begins with a single consistent step forward. Stay curious, keep learning new skills every day, and never underestimate the power of steady progress when you combine patience with passion.',
    recommendedVoice: 'Aoede',
    recommendedStyle: 'podcast' as const,
  },
];

export const DIALOGUE_CHARACTERS = [
  {
    id: 'ក្មេងប្រុស' as const,
    labelKh: 'ក្មេងប្រុស (Young Boy)',
    nameEn: 'Young Boy',
    icon: '👦',
    badge: 'កុមារ',
    defaultVoice: 'Puck',
    colorClass: 'text-sky-400 border-sky-500/40 bg-sky-950/40',
    bgClass: 'bg-sky-950/30',
  },
  {
    id: 'ក្មេងស្រី' as const,
    labelKh: 'ក្មេងស្រី (Young Girl)',
    nameEn: 'Young Girl',
    icon: '👧',
    badge: 'កុមារី',
    defaultVoice: 'Zephyr',
    colorClass: 'text-pink-400 border-pink-500/40 bg-pink-950/40',
    bgClass: 'bg-pink-950/30',
  },
  {
    id: 'មនុស្សចាស់ប្រុស' as const,
    labelKh: 'មនុស្សចាស់ប្រុស (លោកតា)',
    nameEn: 'Old Man / Grandpa',
    icon: '👴',
    badge: 'លោកតា',
    defaultVoice: 'Charon',
    colorClass: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
    bgClass: 'bg-amber-950/30',
  },
  {
    id: 'មនុស្សចាស់ស្រី' as const,
    labelKh: 'មនុស្សចាស់ស្រី (លោកយាយ)',
    nameEn: 'Old Woman / Grandma',
    icon: '👵',
    badge: 'លោកយាយ',
    defaultVoice: 'Kore',
    colorClass: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
    bgClass: 'bg-purple-950/30',
  },
  {
    id: 'ប្រុស' as const,
    labelKh: 'បុរសពេញវ័យ (Adult Male)',
    nameEn: 'Adult Male',
    icon: '👨',
    badge: 'បុរស',
    defaultVoice: 'Fenrir',
    colorClass: 'text-blue-400 border-blue-500/40 bg-blue-950/40',
    bgClass: 'bg-blue-950/30',
  },
  {
    id: 'ស្រី' as const,
    labelKh: 'ស្ត្រីពេញវ័យ (Adult Female)',
    nameEn: 'Adult Female',
    icon: '👩',
    badge: 'ស្ត្រី',
    defaultVoice: 'Kore',
    colorClass: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
    bgClass: 'bg-rose-950/30',
  },
  {
    id: 'ពិធីករ Podcast' as const,
    labelKh: 'ពិធីករ Podcast (Host)',
    nameEn: 'Podcast Host',
    icon: '🎧',
    badge: 'Podcast',
    defaultVoice: 'Aoede',
    colorClass: 'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-950/40',
    bgClass: 'bg-fuchsia-950/30',
  },
  {
    id: 'អ្នកវិភាគ' as const,
    labelKh: 'អ្នកវិភាគ (Analyst)',
    nameEn: 'Senior Analyst',
    icon: '📊',
    badge: 'អ្នកវិភាគ',
    defaultVoice: 'Orus',
    colorClass: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40',
    bgClass: 'bg-cyan-950/30',
  },
];

export const SAMPLE_DIALOGUES: { language: 'km' | 'en'; title: string; desc: string; turns: DialogueTurn[] }[] = [
  {
    language: 'km',
    title: '🎙️ កិច្ចសន្ទនា Podcast & អ្នកវិភាគ (Khmer Podcast)',
    desc: 'ការជជែកវិភាគបច្ចេកវិទ្យា និងសេដ្ឋកិច្ចរវាងពិធីករ Podcast និងអ្នកវិភាគ',
    turns: [
      { id: '1', speaker: 'ពិធីករ Podcast', text: 'សួស្តីប្រិយមិត្ត! សូមស្វាគមន៍មកកាន់កម្មវិធី Podcast ថ្ងៃនេះ។ លោកគ្រូតើបញ្ញាសិប្បនិម្មិត AI កំពុងជួយអ្វីខ្លះដល់អាជីវកម្មនៅកម្ពុជា?' },
      { id: '2', speaker: 'អ្នកវិភាគ', text: 'បាទ អរគុណ! បើតាមការវិភាគជាក់ស្តែង AI ជួយកាត់បន្ថយពេលវេលាផលិតមាតិកា ការបកប្រែ និងការគ្រប់គ្រងទិន្នន័យអតិថិជនបានរហូតដល់ជាង ៦០ ភាគរយ។' },
      { id: '3', speaker: 'ពិធីករ Podcast', text: 'ពិតជាគួរឱ្យចាប់អារម្មណ៍មែន! ដូច្នេះសហគ្រាសខ្នាតតូចគួរតែចាប់ផ្តើមរៀនប្រើប្រាស់ឧបករណ៍ទាំងនេះពីឥឡូវនេះទៅ!' },
      { id: '4', speaker: 'អ្នកវិភាគ', text: 'ត្រឹមត្រូវណាស់! ការចាប់ផ្តើមលឿន និងការប្រើប្រាស់ប្រកបដោយភាពឆ្លាតវៃ គឺជាគន្លឹះនៃភាពជោគជ័យក្នុងយុគសម័យឌីជីថល។' },
    ],
  },
  {
    language: 'km',
    title: '👴👦👧 រឿងនិទានលោកតានិងចៅៗ (Grandpa & Kids Tale)',
    desc: 'ការសន្ទនារវាងលោកតា ចៅប្រុស និងចៅស្រី',
    turns: [
      { id: '1', speaker: 'មនុស្សចាស់ប្រុស', text: 'ចៅៗអើយ! យប់នេះមេឃត្រជាក់ល្អណាស់ តាមានរឿងនិទានកាលពីដើមមួយ តើចៅៗចង់ស្តាប់ទេ?' },
      { id: '2', speaker: 'ក្មេងប្រុស', text: 'បាទលោកតា! ខ្ញុំចង់ស្តាប់ខ្លាំងណាស់ តើជារឿងសត្វព្រៃ ឬរឿងបុរាណទៅលោកតា?' },
      { id: '3', speaker: 'ក្មេងស្រី', text: 'ចាសលោកតា ខ្ញុំក៏ចង់ស្តាប់ដែរ! និទានរឿងទន្សាយនិងអណ្តើកមកណា៎តា!' },
      { id: '4', speaker: 'មនុស្សចាស់ប្រុស', text: 'ល្អណាស់ចៅៗ! អង្គុយជុំគ្នាមក តានឹងនិទានជូនស្តាប់ឥឡូវនេះ...' },
    ],
  },
  {
    language: 'km',
    title: '👦👧 កិច្ចសន្ទនាក្មេងៗនៅសាលា (School Kids)',
    desc: 'ការជជែកគ្នារវាងក្មេងប្រុស និងក្មេងស្រី',
    turns: [
      { id: '1', speaker: 'ក្មេងប្រុស', text: 'សួស្តីធីតា! តើថ្ងៃនេះឯងបានធ្វើកិច្ចការផ្ទះគណិតវិទ្យារួចហើយឬនៅ?' },
      { id: '2', speaker: 'ក្មេងស្រី', text: 'ចាសរតនា! ខ្ញុំធ្វើរួចរាល់តាំងពីល្ងាចមិញម៉្លេះ លំហាត់នោះស្រួលធ្វើទេ!' },
      { id: '3', speaker: 'ក្មេងប្រុស', text: 'អស្ចារ្យណាស់! ចាំបន្តិចទៀតជួយពន្យល់ខ្ញុំត្រង់ចំណុចប្រភាគផងណា៎!' },
      { id: '4', speaker: 'ក្មេងស្រី', text: 'បានតើ! គ្មានបញ្ហាទេ យើងជាមិត្តភក្តិនឹងគ្នាត្រូវជួយគ្នារៀនសូត្រ!' },
    ],
  },
  {
    language: 'km',
    title: '👨👩 ការកុម្ម៉ង់ម្ហូបនៅភោជនីយដ្ឋាន (Restaurant Order)',
    desc: 'ការសន្ទនារវាងភ្ញៀវប្រុស និងបុគ្គលិកស្រី',
    turns: [
      { id: '1', speaker: 'ប្រុស', text: 'សួស្តីប្អូនស្រី! តើថ្ងៃនេះភោជនីយដ្ឋានមានមុខម្ហូបពិសេសអ្វីខ្លះដែលណែនាំ?' },
      { id: '2', speaker: 'ស្រី', text: 'ចាស ជម្រាបសួរលោកបង! ថ្ងៃនេះហាងយើងខ្ញុំមានអាម៉ុកត្រី និងសម្លការីសាច់គោដ៏ឈ្ងុយឆ្ងាញ់ប្រចាំហាងចាស។' },
      { id: '3', speaker: 'ប្រុស', text: 'ល្អណាស់! អ៊ីចឹងជួយយកអាម៉ុកត្រីមួយចាន និងបាយក្តៅមួយចានមកប្អូន។' },
      { id: '4', speaker: 'ស្រី', text: 'ចាសបានលោកបង សូមរង់ចាំមួយភ្លែតណា៎ ចុងភៅយើងខ្ញុំកំពុងរៀបចំជូនភ្លាមៗចាស!' },
    ],
  },
  {
    language: 'en',
    title: '🎙️ Tech & Market Analysis Podcast (English)',
    desc: 'English podcast interview between Podcast Host and Senior Analyst',
    turns: [
      { id: '1', speaker: 'ពិធីករ Podcast', text: 'Welcome back to the Daily Insight Podcast! Today we are breaking down how regional digital economies are evolving this year.' },
      { id: '2', speaker: 'អ្នកវិភាគ', text: 'Thanks for having me. If you look closely at the data, local creators and mid-sized businesses adopting bilingual AI workflows are scaling faster than ever before.' },
      { id: '3', speaker: 'ពិធីករ Podcast', text: 'That is a huge takeaway. What is the single smartest move founders can make right now?' },
      { id: '4', speaker: 'អ្នកវិភាគ', text: 'Focus on audio and multimedia storytelling in both Khmer and English—because authentic connection drives long-term trust.' },
    ],
  },
  {
    language: 'en',
    title: '🇺🇸 Coffee Shop Conversation (English)',
    desc: 'Natural English dialogue between a male customer and female barista',
    turns: [
      { id: '1', speaker: 'ប្រុស', text: 'Hi there! Could I get a medium iced latte with oat milk, please?' },
      { id: '2', speaker: 'ស្រី', text: 'Of course! Would you like any vanilla or caramel syrup with that today?' },
      { id: '3', speaker: 'ប្រុស', text: 'Just a touch of vanilla would be great. Thank you so much!' },
      { id: '4', speaker: 'ស្រី', text: 'You got it! Your drink will be ready at the counter in just two minutes.' },
    ],
  },
];

