// ---------------------------------------------------------------------------
// Trust & Evaluation — frozen text benchmark v1.0.
//
// 120 samples: 40 scam / 40 benign / 40 ambiguous, balanced across
// bn (Bengali script), banglish (Romanized Bengali) and en.
//
// Provenance: synthetic, hand-authored for this benchmark. No private user
// content. Labels were frozen BEFORE any run; prompts are never tuned on
// these samples (the rules engine and prompts predate this dataset).
// Subtypes cover: OTP phishing, MFS/bank impersonation, family impersonation,
// lottery, fake job, fake scholarship, investment, link phishing, plus
// benign advisories (negation), genuine messages and deliberately ambiguous
// cases (unknown callers, vague requests, quoted-scam education).
// ---------------------------------------------------------------------------

export interface BenchSample {
  id: string;
  language: "bn" | "banglish" | "en";
  label: "scam" | "benign" | "ambiguous";
  subtype: string;
  text: string;
}

export const DATASET_VERSION = "text-benchmark-1.0";

export const BENCH_SAMPLES: BenchSample[] = [
  // =========================================================================
  // SCAM — Bengali script (14)
  // =========================================================================
  { id: "S001", language: "bn", label: "scam", subtype: "otp_phishing", text: "প্রিয় গ্রাহক, আপনার বিকাশ একাউন্ট সাসপেন্ড হবে। একাউন্ট চালু রাখতে এখনই এই নম্বরে কল করে ওটিপি দিন: ০৯৬xxxxxxxx" },
  { id: "S002", language: "bn", label: "scam", subtype: "otp_phishing", text: "নগদ টিম থেকে বলছি। আপনার সাম্প্রতিক লেনদেনে সমস্যা হয়েছে, একাউন্ট ব্লক এড়াতে পিন নম্বরটা বলে দিন, এখনই।" },
  { id: "S003", language: "bn", label: "scam", subtype: "mfs_impersonation", text: "আমি বিকাশ এজেন্ট বলছি। আপনার পাঠানো টাকা আটকে গেছে। ফ্রি করতে হলে ৫০০ টাকা প্রসেসিং চার্জ এই নম্বরে পাঠান, সাথে স্ক্রিনশট দিন।" },
  { id: "S004", language: "bn", label: "scam", subtype: "family_impersonation", text: "মা, আমি বিপদে পড়েছি। ফোন হারিয়ে নতুন নম্বর থেকে বলছি। এখনই ২০,০০০ টাকা এই নম্বরে পাঠাও, কাউকে কিছু বলো না।" },
  { id: "S005", language: "bn", label: "scam", subtype: "family_impersonation", text: "আব্বু, আমার অস্ত্রোপচার দরকার। এই মুহূর্তে ৫০ হাজার টাকা পাঠাও, সবাইকে এখনো বলো না, টাকা পাঠালেই ফোন দেবো।" },
  { id: "S006", language: "bn", label: "scam", subtype: "lottery_prize", text: "অভিনন্দন! আপনি ঈদ লাকি ড্রয়ে ১ লাখ টাকা জিতেছেন। পুরস্কার পেতে ২০০ টাকা ফরম ফি পাঠান এই বিকাশ নম্বরে।" },
  { id: "S007", language: "bn", label: "scam", subtype: "lottery_prize", text: "আপনার নম্বরটি বাংলাদেশ শপিং ফেস্টিভালে নির্বাচিত হয়েছে। ৫০,০০০ টাকার ভাউচার পেতে নিচের লিংকে গিয়ে নিবন্ধন করুন: r-tck.win/free" },
  { id: "S008", language: "bn", label: "scam", subtype: "fake_job", text: "অনলাইনে বসে মাসে ৩০,০০০ টাকা ইনকাম! কোনো অভিজ্ঞতা লাগবে না। রেজিস্ট্রেশন ফি মাত্র ৩০০ টাকা। আজই যোগ দিন, সিট সীমিত।" },
  { id: "S009", language: "bn", label: "scam", subtype: "fake_scholarship", text: "আপনি সিলেট এসোসিয়েশন বৃত্তি পাওয়ার চূড়ান্ত তালিকায় আছেন। ৫০০০ টাকা প্রসেসিং ফি দিলেই চেক হাতে পাবেন। আগে কাউকে বলবেন না।" },
  { id: "S010", language: "bn", label: "scam", subtype: "investment_fraud", text: "ভাই, একটা সুযোগ দিচ্ছি। আমার এক ভাইয়ের ফরেক্স কোম্পানিতে ১০ হাজার দিলে মাসে ৪ হাজার লাভ নিশ্চিত। আমি নিজেই ৬ মাস ধরে নিচ্ছি, ভয়ের কিছু নেই।" },
  { id: "S011", language: "bn", label: "scam", subtype: "link_phishing", text: "প্রিয় সঞ্চয়ী, আপনার অ্যাকাউন্ট লক হয়ে গেছে। ২৪ ঘণ্টার মধ্যে ভেরিফাই করুন: sonali-verify.top/login নাহলে সব টাকা ফ্রিজ হবে।" },
  { id: "S012", language: "bn", label: "scam", subtype: "bank_impersonation", text: "এখানে ইসলামী ব্যাংক হেড অফিস। আপনার এনআইডি আপডেট না করলে একাউন্ট বন্ধ হয়ে যাবে। এনআইডি নম্বর আর পিন বলে দিন, আমরা আপডেট করে দিচ্ছি।" },
  { id: "S013", language: "bn", label: "scam", subtype: "gift_card", text: "টেলিগ্রাম চ্যানেলে ফ্রি নেট প্যাকেজ! শুধু ১০টি ফ্রেন্ডকে ফরওয়ার্ড করুন আর রিচার্জ কোড পান। সাথে আপনার বিকাশ পিন দিন, ক্যাশব্যাক পাঠানো হবে।" },
  { id: "S014", language: "bn", label: "scam", subtype: "otp_phishing", text: "র‍্যাব সাইবার টিম থেকে কল। আপনার নম্বরে সন্ত্রাসী কার্যকলাপের অভিযোগ এসেছে। নির্দোষ প্রমাণ করতে এখনই আপনার বিকাশ পিন বলুন, নাহলে নম্বর ব্লক হবে।" },

  // =========================================================================
  // SCAM — Banglish (13)
  // =========================================================================
  { id: "S015", language: "banglish", label: "scam", subtype: "otp_phishing", text: "Bkash theke bolchi. Apnar account e unusual activity hoise. Account block thekate ekhoni ei number e call kore OTP diben." },
  { id: "S016", language: "banglish", label: "scam", subtype: "otp_phishing", text: "Sir, ami Nagad head office theke. Apnar sim re-register korte hobe, nahole account off hoye jabe. PIN number ta ekhoni bolun." },
  { id: "S017", language: "banglish", label: "scam", subtype: "mfs_impersonation", text: "Apnar pathano 5000 taka atke gese. Release korte 150 taka charge ei personal number e pathan, tarpor OTP ta o bolen." },
  { id: "S018", language: "banglish", label: "scam", subtype: "family_impersonation", text: "Amma, ami Dubai theke bolchi, khub bipode porse. Ekhn e 50 hazar taka ei number e pathao, kauke bolo na, phone korle kotha bolbo na." },
  { id: "S019", language: "banglish", label: "scam", subtype: "lottery_prize", text: "Congratulation! Apni dibosher lottery te iPhone 15 jitse. Delivery nite 350 taka courier charge pathan ei number e." },
  { id: "S020", language: "banglish", label: "scam", subtype: "fake_job", text: "Online job opportunity! Daily 1000-1500 taka income. Only mobile lagbe. Registration fee 250 taka. Join korte aj e inbox korun. Limited seat." },
  { id: "S021", language: "banglish", label: "scam", subtype: "fake_scholarship", text: "Apni education board scholarship final list e selected hoise. 2000 taka processing fee diye certificate collect korun, na dile cancel hoye jabe." },
  { id: "S022", language: "banglish", label: "scam", subtype: "investment_fraud", text: "Bhai apnake ekta secret offer dicchi. Amader app e 5000 invest korle 7 days e double. Ami nijei 2 bochor dhore income nichchi. Risk zero." },
  { id: "S023", language: "banglish", label: "scam", subtype: "link_phishing", text: "Dear DBBL customer, apnar ATM card block hoise. Reactivate: dbbl-atm.xyz/verify — 24 hours nei, nahole card bondho hobe." },
  { id: "S024", language: "banglish", label: "scam", subtype: "bank_impersonation", text: "City Bank theke apnake call. Apnar loan approved hoise 3 lakh! Tate agee 5000 taka insurance fee pathan ei number e, tarpor cash paben." },
  { id: "S025", language: "banglish", label: "scam", subtype: "sextortion", text: "Ami apnar private video raksi, hack kore pelam. 20 hazar taka pathan nahole sob family ke pathiye dibo. Police e jaibo na kotha diye." },
  { id: "S026", language: "banglish", label: "scam", subtype: "gift_card", text: "Free recharge offer! Ei link e giye apnar bkash PIN diye login korle 100 taka cashback instant paben: re-charge-bd.online" },
  { id: "S027", language: "banglish", label: "scam", subtype: "otp_phishing", text: "BCS teletek theke SMS: apnar NID sim registration invalid. Verify korar last chance: ekhoni call korun, OTP r PIN ready rakhen." },

  // =========================================================================
  // SCAM — English (13)
  // =========================================================================
  { id: "S028", language: "en", label: "scam", subtype: "otp_phishing", text: "Dear customer, your bKash account will be suspended within 2 hours. To keep it active, share the 6-digit OTP we just sent you with this agent now." },
  { id: "S029", language: "en", label: "scam", subtype: "otp_phishing", text: "This is Nagad security department. We detected a fraudulent transaction. To stop it, tell us your PIN immediately or your whole balance will be drained." },
  { id: "S030", language: "en", label: "scam", subtype: "mfs_impersonation", text: "Hello, I am a bKash agent. Your remittance is on hold at the airport. Pay 2,500 taka release fee to this personal number and it will be delivered today." },
  { id: "S031", language: "en", label: "scam", subtype: "family_impersonation", text: "Mom, this is your son, I lost my phone so I'm texting from a friend's number. I'm in trouble — send 30,000 taka right now and please don't tell Dad yet." },
  { id: "S032", language: "en", label: "scam", subtype: "lottery_prize", text: "Congratulations! Your number won 250,000 BDT in the Dhaka Shopping Festival draw. Send 500 taka as tax via bKash to claim your prize today." },
  { id: "S033", language: "en", label: "scam", subtype: "fake_job", text: "WORK FROM HOME! Earn 25,000 taka monthly by liking YouTube videos. No experience needed. Pay 300 taka registration fee to start. Limited seats!" },
  { id: "S034", language: "en", label: "scam", subtype: "fake_scholarship", text: "You have been selected for the Chancellor's scholarship worth 100,000 taka. Wire 3,000 taka processing fee within 48 hours or the seat goes to another student." },
  { id: "S035", language: "en", label: "scam", subtype: "investment_fraud", text: "Sir, guaranteed 40% monthly return on your investment in our forex fund. I have been earning for 6 months, zero risk. Send 10,000 and see your money double." },
  { id: "S036", language: "en", label: "scam", subtype: "link_phishing", text: "Alert: your Eastern Bank internet banking is locked. Unlock now at ebl-secure-login.top/verify within 24 hours or your account will be closed." },
  { id: "S037", language: "en", label: "scam", subtype: "bank_impersonation", text: "This is the BRAC Bank loan department. Your 5 lakh loan is approved! Just pay 8,000 taka advance fee to this number and cash will be delivered to your home." },
  { id: "S038", language: "en", label: "scam", subtype: "sextortion", text: "I hacked your phone camera and recorded private videos. Send 15,000 taka within 24 hours or I will send everything to your family and friends list." },
  { id: "S039", language: "en", label: "scam", subtype: "gift_card", text: "Free 10GB internet for all Bangladeshi users! Just forward this message to 10 friends and send your bKash PIN to receive the recharge code instantly." },
  { id: "S040", language: "en", label: "scam", subtype: "qr_phishing", text: "Scan this QR code to receive your government cash assistance of 2,000 taka. Hurry, offer closes today. (QR points to verify-assist.top)" },

  // =========================================================================
  // BENIGN — Bengali script (14)
  // =========================================================================
  { id: "S041", language: "bn", label: "benign", subtype: "bank_advisory", text: "প্রিয় গ্রাহক, ব্যাংক কখনো ফোনে বা এসএমএসে আপনার ওটিপি বা পিন চায় না। কেউ চাইলে সেটি প্রতারণা — সাথে সাথে ৩৩৪৯৯ নম্বরে জানান।" },
  { id: "S042", language: "bn", label: "benign", subtype: "bank_advisory", text: "সতর্কতা: লটারির নামে অগ্রিম ফি চাওয়া প্রতারণা। কোনো প্রতিষ্ঠান পুরস্কার দিতে আগে টাকা চায় না। সন্দেহ হলে অ্যাপের ভেতর থেকে যাচাই করুন।" },
  { id: "S043", language: "bn", label: "benign", subtype: "family_message", text: "মা, আমি অফিস থেকে ফিরছি। রাতের খাবারে ডিম ভাজা থাকলে খেতে ইচ্ছে করছে। ভাইয়ের ওষুধটা কিনে আসবো?" },
  { id: "S044", language: "bn", label: "benign", subtype: "family_message", text: "আব্বু, তোমার চাপের ওষুধ শেষ হয়ে গেছে। বিকেলে ফার্মেসি থেকে কিনে রাখবো, তুমি শুধু বিশ্রাম নাও।" },
  { id: "S045", language: "bn", label: "benign", subtype: "transaction_sms", text: "আপনার বিকাশ একাউন্টে ৫,০০০.০০ টাকা ক্রেডিট হয়েছে। ব্যালেন্স: ১২,৩৫০.০০ টাকা। এটি বিকাশের অফিসিয়াল এসএমএস।" },
  { id: "S046", language: "bn", label: "benign", subtype: "appointment", text: "প্রিয় রুকসানা, আপনার ডাক্তার মিলার অ্যাপয়েন্টমেন্ট কাল ১১টায় নিশ্চিত হয়েছে। সাথে পুরনো প্রেসক্রিপশন আনতে ভুলবেন না।" },
  { id: "S047", language: "bn", label: "benign", subtype: "school_notice", text: "সুশ্রী অভিভাবক, আগামীকাল স্কুলের বার্ষিক ক্রীড়া প্রতিযোগিতা। সন্তানকে সকাল ৯টায় পৌঁছে দিন। বিকেল ২টায় ছুটি।" },
  { id: "S048", language: "bn", label: "benign", subtype: "work_message", text: "রফিক ভাই, কালকের মিটিংয়ের স্লাইডগুলো শেয়ার করে দিলাম। সকালে একবার দেখে নিলে ভালো হয়। রিভিউ নোটগুলোও আছে সেখানে।" },
  { id: "S049", language: "bn", label: "benign", subtype: "bill_reminder", text: "আপনার এই মাসের বিদ্যুৎ বিল ৮৪০ টাকা। শেষ তারিখ ২৫ তারিখ। পেমেন্ট করতে নিজে অ্যাপে লগইন করুন — কেউ নম্বর জিজ্ঞেস করলে দেবেন না।" },
  { id: "S050", language: "bn", label: "benign", subtype: "delivery_notice", text: "আপনার পার্সেল (ফ্যাশন অর্ডার #৪৫২১) আজ বিকেল ৪-৬টার মধ্যে পৌঁছে দেওয়া হবে। ডেলিভারি ম্যান আসার আগে ফোন করবেন না, তারা নিজেরাই কল করে।" },
  { id: "S051", language: "bn", label: "benign", subtype: "friend_message", text: "এই যে আমার বন্ধু! অনেকদিন দেখা হয়নি। এই শুক্রবার কি পুরান দিনের মতো চা খেতে যাবো? তুই একটা জায়গা ঠিক করে দে।" },
  { id: "S052", language: "bn", label: "benign", subtype: "health_message", text: "আপনার ডায়াবেটিস চেকআপের রিপোর্ট প্রস্তুত। নমুনা দেওয়ার আগে ১০ ঘণ্টা না খেয়ে থাকবেন। যেকোনো প্রশ্ন থাকলে হটলাইনে জানান।" },
  { id: "S053", language: "bn", label: "benign", subtype: "ride_receipt", text: "যাত্রা সম্পন্ন হলো। ভাড়া ২২০ টাকা কাটা হয়েছে। ড্রাইভারকে ৫ স্টার দিতে ভুলবেন না। যাত্রার রসিট সংরক্ষণ করুন।" },
  { id: "S054", language: "bn", label: "benign", subtype: "quoted_scam_education", text: "আজকের সচেতনতা-পাঠ: প্রতারকরা লিখে থাকে — 'আপনার একাউন্ট ব্লক হবে, ওটিপি দিন'। মনে রাখবেন, ব্যাংক কখনো ওটিপি চায় না, চাইলেই সেটি প্রতারণা।" },

  // =========================================================================
  // BENIGN — Banglish (13)
  // =========================================================================
  { id: "S055", language: "banglish", label: "benign", subtype: "bank_advisory", text: "Projonmo, bank kokhono phone e OTP ba PIN chay na. Keu chaille seti promoshon na — sathe sathe bank er app e report korun." },
  { id: "S056", language: "banglish", label: "benign", subtype: "family_message", text: "Amma, ami bazar theke aschi. Mach kinechi, dim nei. Rater khawa barir boro chulay dia ashte bolo, lomba bojhay aj late habo." },
  { id: "S057", language: "banglish", label: "benign", subtype: "transaction_sms", text: "Apnar Nagad account e 2,000 taka credit hoise. Balance: 8,450 taka. Ei SMS ta official, kono link e click korte hobe na." },
  { id: "S058", language: "banglish", label: "benign", subtype: "work_message", text: "Bhai ajker standup meeting 11 tay. Apnar task er progress ta ektu bolen, ami board e update kore dicchi." },
  { id: "S059", language: "banglish", label: "benign", subtype: "appointment", text: "Sir, apnar dentist appointment kal somoy 5 tay confirm hoise. Jodi somoy change korte cai, agey janaben." },
  { id: "S060", language: "banglish", label: "benign", subtype: "school_notice", text: "Parent, kal school e science fair. Apnar shontan er project 10 number booth e ache. 9 tay asar jonne onugohon korun." },
  { id: "S061", language: "banglish", label: "benign", subtype: "friend_message", text: "Orey ki khobor! Onek din hoilo dekha hoi nai. Ei Friday cole asho, university er pukur parer chayer dokane — aro koyekjon asbe." },
  { id: "S062", language: "banglish", label: "benign", subtype: "bill_reminder", text: "Apnar ei maser gas bill 1,120 taka. Last date 28 tarikh. Nijei app e giye pay korun, keu number chaille deyen na." },
  { id: "S063", language: "banglish", label: "benign", subtype: "delivery_notice", text: "Apnar order #7788 aj delivery hobe somoy 3-5 tar moddhe. Delivery man asar age ekta message diben, kono extra taka lagbe na." },
  { id: "S064", language: "banglish", label: "benign", subtype: "health_message", text: "Bua, apnar medicine gulo ready. Kal sonibar ar niye jaben, jodi somoy na pai pars o baro nite parben." },
  { id: "S065", language: "banglish", label: "benign", subtype: "quoted_scam_education", text: "Sobaike jananor jonne: proshopnora lekhe — 'apni lottery jitse, fee pathan'. Ei dhoroner message gulo promoshon. Kono fee pathaben na." },
  { id: "S066", language: "banglish", label: "benign", subtype: "work_message", text: "Team, kal public holiday. Client demo pulao briddho somoye. Notun deadline next Monday — tension nai, apnara ready achen." },
  { id: "S067", language: "banglish", label: "benign", subtype: "family_message", text: "Baba, apnar chosma'r kacha ta vange gese? Ami sathe sathe notun kore dilam, bazar e giye pabo — apni chinta korun na." },

  // =========================================================================
  // BENIGN — English (13)
  // =========================================================================
  { id: "S068", language: "en", label: "benign", subtype: "bank_advisory", text: "Reminder from your bank: we will NEVER call you to ask for your OTP or PIN. If anyone requests these, it is fraud — hang up and report via the official app." },
  { id: "S069", language: "en", label: "benign", subtype: "transaction_sms", text: "Your bKash account has been credited with 3,000.00 BDT. Balance: 15,200.00 BDT. This is an official notification; no action needed." },
  { id: "S070", language: "en", label: "benign", subtype: "family_message", text: "Hi Dad, my finals end on the 20th. I'll come home that weekend — Mom asked me to tell you not to cook on Friday, we'll eat out together." },
  { id: "S071", language: "en", label: "benign", subtype: "appointment", text: "Your dental cleaning appointment is confirmed for Thursday at 4:30 PM. Please arrive 10 minutes early to complete the check-in form." },
  { id: "S072", language: "en", label: "benign", subtype: "work_message", text: "Team, the client approved the revised design. Great work everyone. Let's plan the sprint retro for Monday morning — I'll send the agenda tonight." },
  { id: "S073", language: "en", label: "benign", subtype: "school_notice", text: "Dear parents, the annual sports day is this Saturday. Students should arrive by 8:30 AM in their house colors. Refreshments will be provided." },
  { id: "S074", language: "en", label: "benign", subtype: "bill_reminder", text: "Your internet bill of 900 BDT is due on the 15th. Pay through the app or any authorized center. We never ask for passwords over the phone." },
  { id: "S075", language: "en", label: "benign", subtype: "delivery_notice", text: "Your parcel (order #A1024) is out for delivery and will arrive between 2-4 PM today. The courier will call you upon arrival at your gate." },
  { id: "S076", language: "en", label: "benign", subtype: "friend_message", text: "Hey! Long time no see. A few of us are meeting at the tea stall on Friday evening after maghrib. You free? It would be great to catch up." },
  { id: "S077", language: "en", label: "benign", subtype: "health_message", text: "Your lab results are ready and normal. Continue the current medication as prescribed and visit for a follow-up next month. No urgent concerns." },
  { id: "S078", language: "en", label: "benign", subtype: "ride_receipt", text: "Trip completed. Fare: 180 BDT, paid from your wallet. Rate your driver in the app. Receipt saved to your trip history automatically." },
  { id: "S079", language: "en", label: "benign", subtype: "quoted_scam_education", text: "Awareness post: scammers often write 'your account will be blocked, send the OTP'. Remember — banks never ask for OTPs. Any such message is a scam." },
  { id: "S080", language: "en", label: "benign", subtype: "family_message", text: "Son, your grandmother's knee surgery went well. She's resting now and the doctor says she can walk again in two weeks. We'll call you tonight." },

  // =========================================================================
  // AMBIGUOUS — Bengali script (14)
  // =========================================================================
  { id: "S081", language: "bn", label: "ambiguous", subtype: "unknown_urgent", text: "ভাই, আমি রুমমেট। জরুরি কথা আছে, একটু কল দিবেন? একটু সাহায্য লাগবে।" },
  { id: "S082", language: "bn", label: "ambiguous", subtype: "unknown_urgent", text: "আসসালামু আলাইকুম, আমি আপনার এক আত্মীয়ের বন্ধু বলছি। আপনার ছোট ভাইয়ের একটু সমস্যা হয়েছে, একবার কথা বলবেন?" },
  { id: "S083", language: "bn", label: "ambiguous", subtype: "vague_money_request", text: "আপু, একটু টাকা লাগবে, কালকেই ফেরত দিয়ে দেবো। পারলে বিকেলের মধ্যে দরকার।" },
  { id: "S084", language: "bn", label: "ambiguous", subtype: "vague_money_request", text: "ভাইয়া, ২০০০ টাকা পাঠাতে পারবেন? কারণটা ফোনে বলবো, লিখতে ইচ্ছে করছে না।" },
  { id: "S085", language: "bn", label: "ambiguous", subtype: "job_offer_unclear", text: "আমাদের প্রতিষ্ঠানে ডাটা এন্ট্রির কাজের সুযোগ আছে। আগ্রহী হলে জানাবেন, বিস্তারিত আলোচনা হবে।" },
  { id: "S086", language: "bn", label: "ambiguous", subtype: "offer_unclear", text: "আপনাকে আমাদের নতুন সেভিংস প্ল্যানের বিশেষ সুবিধা দেওয়া হচ্ছে। আগ্রহ থাকলে এই সপ্তাহে যোগাযোগ করুন।" },
  { id: "S087", language: "bn", label: "ambiguous", subtype: "unknown_emergency_claim", text: "আমি হাসপাতাল থেকে বলছি, আপনার পরিচিত একজন ভর্তি আছেন। জরুরি একটু সহযোগিতা দরকার, কল দিন।" },
  { id: "S088", language: "bn", label: "ambiguous", subtype: "crypto_mention", text: "ভাই, এখন ক্রিপ্টোর দাম অনেক কমে গেছে। একটু দেখে বলেন, কেনার মতো পরিস্থিতি কি?" },
  { id: "S089", language: "bn", label: "ambiguous", subtype: "callback_request", text: "স্যার, আপনার একটা ডকুমেন্ট জমা দেওয়া লাগবে। সুবিধামতো সময়ে একটা কল দিলে বুঝিয়ে বলবো।" },
  { id: "S090", language: "bn", label: "ambiguous", subtype: "upgrade_offer", text: "আপনার সিমে ফ্রি মিনিট ও ইন্টারনেট অফার এসেছে। সীমিত সময়ের জন্য। চাইলে রিপ্লাই করুন: YES" },
  { id: "S091", language: "bn", label: "ambiguous", subtype: "unknown_urgent", text: "দাদু, আমি তোমার নাতি, নম্বরটা হারিয়ে গিয়েছিল বলে বন্ধুর ফোন থেকে বলছি। পরে কথা বলবো, এখন একটু টাকা দরকার।" },
  { id: "S092", language: "bn", label: "ambiguous", subtype: "vague_money_request", text: "এক্ষুন একটু সাহায্য করতে পারবেন? খুব জরুরি, বিস্তারিত এসে বলবো।" },
  { id: "S093", language: "bn", label: "ambiguous", subtype: "prize_unclear", text: "আপনি আমাদের ক্রীড়া প্রতিযোগিতার বিজয়ী তালিকায় আছেন কিনা যাচাই করুন। জিতলে সান্ত্বনা পুরস্কার আছে।" },
  { id: "S094", language: "bn", label: "ambiguous", subtype: "unknown_urgent", text: "আন্টি, আমি পাশের ফ্ল্যাটের ছেলে বলছি। আপনার বাসা বানানো নিয়ে একটা কাগজ দরকার, দরজা খুলবেন?" },

  // =========================================================================
  // AMBIGUOUS — Banglish (13)
  // =========================================================================
  { id: "S095", language: "banglish", label: "ambiguous", subtype: "unknown_urgent", text: "Bhai, ekta urgent kotha ase. Ekta call diben? Ektu help lagbe, onno kichu na." },
  { id: "S096", language: "banglish", label: "ambiguous", subtype: "vague_money_request", text: "Apu, 1000 taka lagbe. Kalkei pathiye dibo, promish. Bikale er moddhe dile bhalo hoto." },
  { id: "S097", language: "banglish", label: "ambiguous", subtype: "unknown_emergency_claim", text: "Hospital theke bolchi, apnar ekjon chera hospital e ase. Emergency te ase, ektu call din please." },
  { id: "S098", language: "banglish", label: "ambiguous", subtype: "job_offer_unclear", text: "Amader ekta company te part time job opportunity ase. Interest thakle mail korun, details discussion e bolbo." },
  { id: "S099", language: "banglish", label: "ambiguous", subtype: "offer_unclear", text: "Apnake amader new premium service er special offer dicchi. Ei week e join korle extra benefit paben, bhalo ase." },
  { id: "S100", language: "banglish", label: "ambiguous", subtype: "family_contact_unclear", text: "Dada, ami tomar boner classmate. Tomar barite jete hobe ekta kaje, apnar number dise. Kothay paben?" },
  { id: "S101", language: "banglish", label: "ambiguous", subtype: "vague_money_request", text: "Ekhn e ektu taka dorkar, karon ta phone e bolbo. Ashole ekta jinish kinte hobe." },
  { id: "S102", language: "banglish", label: "ambiguous", subtype: "crypto_mention", text: "Bhai crypto nia ki bhabsen? Ekta group ase jekhane daily signal dey, debi aro details?" },
  { id: "S103", language: "banglish", label: "ambiguous", subtype: "callback_request", text: "Sir, apnar ektu time lagbe. Ekta document process korte kichu information lagbo, call korun subidha moto." },
  { id: "S104", language: "banglish", label: "ambiguous", subtype: "unknown_urgent", text: "Nana, ami apnar nati, phone harie friend er phone theke bolchi. Ektu taka pathaben, pore bole dibo kiser lage." },
  { id: "S105", language: "banglish", label: "ambiguous", subtype: "upgrade_offer", text: "Congratulation! Apni amader special customer. Ekta exclusive offer ase apnar jonne, reply korun: GO" },
  { id: "S106", language: "banglish", label: "ambiguous", subtype: "prize_unclear", text: "Apni amader monthly quiz er lucky list e achen. Confirm korte ei number e SMS korun, gift ta paben." },
  { id: "S107", language: "banglish", label: "ambiguous", subtype: "unknown_urgent", text: "Uncle, ami apnar bari er kajer lok er chele. Kichu ekta jinish lagbe, ekta call diben?" },

  // =========================================================================
  // AMBIGUOUS — English (13)
  // =========================================================================
  { id: "S108", language: "en", label: "ambiguous", subtype: "unknown_urgent", text: "Hi, this is your roommate. Something urgent came up, can you call me back when you see this? Need a small favor." },
  { id: "S109", language: "en", label: "ambiguous", subtype: "vague_money_request", text: "Bro, can you send 1500 taka? I'll explain later, it's a bit personal. Will return it next week for sure." },
  { id: "S110", language: "en", label: "ambiguous", subtype: "unknown_emergency_claim", text: "Hello, calling from the clinic. Someone close to you was brought in today. Please call back urgently regarding their condition." },
  { id: "S111", language: "en", label: "ambiguous", subtype: "job_offer_unclear", text: "We have openings for part-time data entry at our firm. If interested, send your details and we will discuss the specifics." },
  { id: "S112", language: "en", label: "ambiguous", subtype: "offer_unclear", text: "As a valued customer you qualify for our special savings plan with extra benefits this week. Reply if interested to learn more." },
  { id: "S113", language: "en", label: "ambiguous", subtype: "family_contact_unclear", text: "Hi uncle, this is Rafi's classmate. He asked me to contact you about something at home. When are you available?" },
  { id: "S114", language: "en", label: "ambiguous", subtype: "vague_money_request", text: "Can you help me out with some money today? It's important — I'll tell you everything on the phone, don't want to write it here." },
  { id: "S115", language: "en", label: "ambiguous", subtype: "crypto_mention", text: "Hey, what do you think about crypto right now? I joined a group that shares daily signals. Want me to add you?" },
  { id: "S116", language: "en", label: "ambiguous", subtype: "callback_request", text: "Sir, your document is ready for processing. We need to verify some information — please call back at your convenience." },
  { id: "S117", language: "en", label: "ambiguous", subtype: "unknown_urgent", text: "Grandpa, it's your grandson — lost my phone, texting from a friend's number. Can you send a little money? I'll explain later." },
  { id: "S118", language: "en", label: "ambiguous", subtype: "upgrade_offer", text: "Congratulations! You have been selected for our exclusive upgrade offer. Limited period only — reply YES to activate." },
  { id: "S119", language: "en", label: "ambiguous", subtype: "prize_unclear", text: "You are on our monthly lucky-draw shortlist. To confirm your entry and collect your gift, send us a message today." },
  { id: "S120", language: "en", label: "ambiguous", subtype: "unknown_urgent", text: "Aunty, this is the boy from the flat next door. I need to discuss something about your parcel — could you open the door?" },
];

export const SAMPLE_COUNT = BENCH_SAMPLES.length;
