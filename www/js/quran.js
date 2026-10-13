// In-app Qur'an audio player: reciter + surah + ayah-range selection, streamed (not
// bundled) from everyayah.com's per-ayah archive. Surah metadata below is the
// standard 114-surah Hafs numbering (number, English name, Arabic name, ayah count).
const Quran = (() => {

  // [number, englishName, arabicName, numberOfAyahs]
  const RAW_SURAHS = [
    [1,'Al-Faatiha','سُورَةُ ٱلْفَاتِحَةِ',7],[2,'Al-Baqara','سُورَةُ البَقَرَةِ',286],
    [3,'Aal-i-Imraan','سُورَةُ آلِ عِمۡرَانَ',200],[4,'An-Nisaa','سُورَةُ النِّسَاءِ',176],
    [5,'Al-Maaida','سُورَةُ المَائـِدَةِ',120],[6,"Al-An'aam",'سُورَةُ الأَنۡعَامِ',165],
    [7,"Al-A'raaf",'سُورَةُ الأَعۡرَافِ',206],[8,'Al-Anfaal','سُورَةُ الأَنفَالِ',75],
    [9,'At-Tawba','سُورَةُ التَّوۡبَةِ',129],[10,'Yunus','سُورَةُ يُونُسَ',109],
    [11,'Hud','سُورَةُ هُودٍ',123],[12,'Yusuf','سُورَةُ يُوسُفَ',111],
    [13,"Ar-Ra'd",'سُورَةُ الرَّعۡدِ',43],[14,'Ibrahim','سُورَةُ إِبۡرَاهِيمَ',52],
    [15,'Al-Hijr','سُورَةُ الحِجۡرِ',99],[16,'An-Nahl','سُورَةُ النَّحۡلِ',128],
    [17,'Al-Israa','سُورَةُ الإِسۡرَاءِ',111],[18,'Al-Kahf','سُورَةُ الكَهۡفِ',110],
    [19,'Maryam','سُورَةُ مَرۡيَمَ',98],[20,'Taa-Haa','سُورَةُ طه',135],
    [21,'Al-Anbiyaa','سُورَةُ الأَنبِيَاءِ',112],[22,'Al-Hajj','سُورَةُ الحَجِّ',78],
    [23,'Al-Muminoon','سُورَةُ المُؤۡمِنُونَ',118],[24,'An-Noor','سُورَةُ النُّورِ',64],
    [25,'Al-Furqaan','سُورَةُ الفُرۡقَانِ',77],[26,"Ash-Shu'araa",'سُورَةُ الشُّعَرَاءِ',227],
    [27,'An-Naml','سُورَةُ النَّمۡلِ',93],[28,'Al-Qasas','سُورَةُ القَصَصِ',88],
    [29,'Al-Ankaboot','سُورَةُ العَنكَبُوتِ',69],[30,'Ar-Room','سُورَةُ الرُّومِ',60],
    [31,'Luqman','سُورَةُ لُقۡمَانَ',34],[32,'As-Sajda','سُورَةُ السَّجۡدَةِ',30],
    [33,'Al-Ahzaab','سُورَةُ الأَحۡزَابِ',73],[34,'Saba','سُورَةُ سَبَإٍ',54],
    [35,'Faatir','سُورَةُ فَاطِرٍ',45],[36,'Yaseen','سُورَةُ يسٓ',83],
    [37,'As-Saaffaat','سُورَةُ الصَّافَّاتِ',182],[38,'Saad','سُورَةُ صٓ',88],
    [39,'Az-Zumar','سُورَةُ الزُّمَرِ',75],[40,'Ghafir','سُورَةُ غَافِرٍ',85],
    [41,'Fussilat','سُورَةُ فُصِّلَتۡ',54],[42,'Ash-Shura','سُورَةُ الشُّورَىٰ',53],
    [43,'Az-Zukhruf','سُورَةُ الزُّخۡرُفِ',89],[44,'Ad-Dukhaan','سُورَةُ الدُّخَانِ',59],
    [45,'Al-Jaathiya','سُورَةُ الجَاثِيَةِ',37],[46,'Al-Ahqaf','سُورَةُ الأَحۡقَافِ',35],
    [47,'Muhammad','سُورَةُ مُحَمَّدٍ',38],[48,'Al-Fath','سُورَةُ الفَتۡحِ',29],
    [49,'Al-Hujuraat','سُورَةُ الحُجُرَاتِ',18],[50,'Qaaf','سُورَةُ قٓ',45],
    [51,'Adh-Dhaariyat','سُورَةُ الذَّارِيَاتِ',60],[52,'At-Tur','سُورَةُ الطُّورِ',49],
    [53,'An-Najm','سُورَةُ النَّجۡمِ',62],[54,'Al-Qamar','سُورَةُ القَمَرِ',55],
    [55,'Ar-Rahmaan','سُورَةُ الرَّحۡمَٰن',78],[56,'Al-Waaqia','سُورَةُ الوَاقِعَةِ',96],
    [57,'Al-Hadid','سُورَةُ الحَدِيدِ',29],[58,'Al-Mujaadila','سُورَةُ المُجَادلَةِ',22],
    [59,'Al-Hashr','سُورَةُ الحَشۡرِ',24],[60,'Al-Mumtahana','سُورَةُ المُمۡتَحنَةِ',13],
    [61,'As-Saff','سُورَةُ الصَّفِّ',14],[62,"Al-Jumu'a",'سُورَةُ الجُمُعَةِ',11],
    [63,'Al-Munaafiqoon','سُورَةُ المُنَافِقُونَ',11],[64,'At-Taghaabun','سُورَةُ التَّغَابُنِ',18],
    [65,'At-Talaaq','سُورَةُ الطَّلَاقِ',12],[66,'At-Tahrim','سُورَةُ التَّحۡرِيمِ',12],
    [67,'Al-Mulk','سُورَةُ المُلۡكِ',30],[68,'Al-Qalam','سُورَةُ القَلَمِ',52],
    [69,'Al-Haaqqa','سُورَةُ الحَاقَّةِ',52],[70,"Al-Ma'aarij",'سُورَةُ المَعَارِجِ',44],
    [71,'Nooh','سُورَةُ نُوحٍ',28],[72,'Al-Jinn','سُورَةُ الجِنِّ',28],
    [73,'Al-Muzzammil','سُورَةُ المُزَّمِّلِ',20],[74,'Al-Muddaththir','سُورَةُ المُدَّثِّرِ',56],
    [75,'Al-Qiyaama','سُورَةُ القِيَامَةِ',40],[76,'Al-Insaan','سُورَةُ الإِنسَانِ',31],
    [77,'Al-Mursalaat','سُورَةُ المُرۡسَلَاتِ',50],[78,'An-Naba','سُورَةُ النَّبَإِ',40],
    [79,"An-Naazi'aat",'سُورَةُ النَّازِعَاتِ',46],[80,'Abasa','سُورَةُ عَبَسَ',42],
    [81,'At-Takwir','سُورَةُ التَّكۡوِيرِ',29],[82,'Al-Infitaar','سُورَةُ الانفِطَارِ',19],
    [83,'Al-Mutaffifin','سُورَةُ المُطَفِّفِينَ',36],[84,'Al-Inshiqaaq','سُورَةُ الانشِقَاقِ',25],
    [85,'Al-Burooj','سُورَةُ البُرُوجِ',22],[86,'At-Taariq','سُورَةُ الطَّارِقِ',17],
    [87,"Al-A'laa",'سُورَةُ الأَعۡلَىٰ',19],[88,'Al-Ghaashiya','سُورَةُ الغَاشِيَةِ',26],
    [89,'Al-Fajr','سُورَةُ الفَجۡرِ',30],[90,'Al-Balad','سُورَةُ البَلَدِ',20],
    [91,'Ash-Shams','سُورَةُ الشَّمۡسِ',15],[92,'Al-Lail','سُورَةُ اللَّيۡلِ',21],
    [93,'Ad-Dhuhaa','سُورَةُ الضُّحَىٰ',11],[94,'Ash-Sharh','سُورَةُ الشَّرۡحِ',8],
    [95,'At-Tin','سُورَةُ التِّينِ',8],[96,'Al-Alaq','سُورَةُ العَلَقِ',19],
    [97,'Al-Qadr','سُورَةُ القَدۡرِ',5],[98,'Al-Bayyina','سُورَةُ البَيِّنَةِ',8],
    [99,'Az-Zalzala','سُورَةُ الزَّلۡزَلَةِ',8],[100,'Al-Aadiyaat','سُورَةُ العَادِيَاتِ',11],
    [101,"Al-Qaari'a",'سُورَةُ القَارِعَةِ',11],[102,'At-Takaathur','سُورَةُ التَّكَاثُرِ',8],
    [103,'Al-Asr','سُورَةُ العَصۡرِ',3],[104,'Al-Humaza','سُورَةُ الهُمَزَةِ',9],
    [105,'Al-Fil','سُورَةُ الفِيلِ',5],[106,'Quraish','سُورَةُ قُرَيۡشٍ',4],
    [107,"Al-Maa'un",'سُورَةُ المَاعُونِ',7],[108,'Al-Kawthar','سُورَةُ الكَوۡثَرِ',3],
    [109,'Al-Kaafiroon','سُورَةُ الكَافِرُونَ',6],[110,'An-Nasr','سُورَةُ النَّصۡرِ',3],
    [111,'Al-Masad','سُورَةُ المَسَدِ',5],[112,'Al-Ikhlaas','سُورَةُ الإِخۡلَاصِ',4],
    [113,'Al-Falaq','سُورَةُ الفَلَقِ',5],[114,'An-Naas','سُورَةُ النَّاسِ',6],
  ];

  const SURAHS = RAW_SURAHS.map(([number, englishName, arabicName, ayahs]) => ({ number, englishName, arabicName, ayahs }));

  function pad3(n) { return String(n).padStart(3, '0'); }

  // Reciters — the six requested, plus whichever granularity each can actually
  // support. The five on everyayah.com stream any ayah range directly; Ahmed Talib
  // Hameed isn't in that per-ayah archive, so he streams full-surah files instead
  // (from mp3quran.net, confirmed reachable) rather than guessing a broken URL.
  const RECITERS = [
    { id:'alafasy', name:'Mishary Alafasy', granularity:'ayah', slug:'Alafasy_128kbps' },
    { id:'husary', name:'Mahmoud Khalil Al-Husary', granularity:'ayah', slug:'Husary_128kbps' },
    { id:'minshawi', name:'Mohamed Siddiq El-Minshawi', granularity:'ayah', slug:'Minshawy_Murattal_128kbps' },
    { id:'muaiqly', name:'Maher Al-Muaiqly', granularity:'ayah', slug:'MaherAlMuaiqly128kbps' },
    { id:'dossari', name:'Yasser Al-Dosari', granularity:'ayah', slug:'Yasser_Ad-Dussary_128kbps' },
    { id:'talibhameed', name:'Ahmed Talib Hameed', granularity:'surah',
      surahUrl: (n) => `https://server16.mp3quran.net/a_binhameed/Rewayat-Hafs-A-n-Assem/${pad3(n)}.mp3` },
  ];

  function reciterById(id) { return RECITERS.find(r => r.id === id) || RECITERS[0]; }
  function surahByNumber(n) { return SURAHS.find(s => s.number === n) || SURAHS[0]; }

  function ayahUrl(reciter, surahNum, ayahNum) {
    return `https://everyayah.com/data/${reciter.slug}/${pad3(surahNum)}${pad3(ayahNum)}.mp3`;
  }

  // Builds the ordered list of tracks the player will queue through.
  // opts: { reciterId, surahNum, startAyah, endAyah, repeatMode: 'perAyah'|'wholeRange', repeatCount }
  function buildQueue(opts) {
    const reciter = reciterById(opts.reciterId);
    const surah = surahByNumber(opts.surahNum);
    const repeatCount = Math.max(1, Math.min(20, opts.repeatCount || 1));

    if (reciter.granularity === 'surah') {
      const out = [];
      for (let r = 0; r < repeatCount; r++) {
        out.push({ surah: surah.number, ayah: null, label: surah.englishName, url: reciter.surahUrl(surah.number) });
      }
      return out;
    }

    const start = Math.max(1, Math.min(opts.startAyah || 1, surah.ayahs));
    const end = Math.max(start, Math.min(opts.endAyah || surah.ayahs, surah.ayahs));
    const ayahs = [];
    for (let a = start; a <= end; a++) ayahs.push(a);

    const out = [];
    if (opts.repeatMode === 'wholeRange') {
      for (let r = 0; r < repeatCount; r++) {
        ayahs.forEach(a => out.push({ surah: surah.number, ayah: a, label: `${surah.englishName} ${a}`, url: ayahUrl(reciter, surah.number, a) }));
      }
    } else {
      ayahs.forEach(a => {
        for (let r = 0; r < repeatCount; r++) out.push({ surah: surah.number, ayah: a, label: `${surah.englishName} ${a}`, url: ayahUrl(reciter, surah.number, a) });
      });
    }
    return out;
  }

  return { SURAHS, RECITERS, reciterById, surahByNumber, ayahUrl, buildQueue };
})();
