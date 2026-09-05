'use strict';

const DEFAULT_GAME_CONTENT = {
  quizQuestions: [
    { question:'ما هي عاصمة الأردن؟', answer:'عمان' },
    { question:'كم عدد أيام الأسبوع؟', answer:'7' },
    { question:'ما هو أكبر كوكب في المجموعة الشمسية؟', answer:'المشتري' },
    { question:'كم عدد أشهر السنة؟', answer:'12' },
    { question:'ما هو الكوكب المعروف بالكوكب الأحمر؟', answer:'المريخ' },
    { question:'كم يساوي 5 + 5؟', answer:'10' },
    { question:'ما هي عاصمة فلسطين؟', answer:'القدس' },
    { question:'ما هو الحيوان المعروف بملك الغابة؟', answer:'الأسد' },
    { question:'كم عدد أضلاع المثلث؟', answer:'3' },
    { question:'كم عدد القارات؟', answer:'7' }
  ],
  trueFalseQuestions: [
    { question:'الشمس نجم.', answer:'صح' },
    { question:'الأرض أكبر من الشمس.', answer:'خطأ' },
    { question:'الماء يتجمد عند 0 درجة مئوية.', answer:'صح' },
    { question:'عدد أيام السنة 365 يومًا.', answer:'صح' },
    { question:'الأرض تدور حول الشمس.', answer:'صح' }
  ],
  wordQuestions: [
    { scrambled:'نمعا', answer:'عمان' },
    { scrambled:'سدأ', answer:'أسد' },
    { scrambled:'مقل', answer:'قلم' },
    { scrambled:'باتك', answer:'كتاب' },
    { scrambled:'ةرجش', answer:'شجرة' },
    { scrambled:'ةرايس', answer:'سيارة' }
  ],
  speedWords: ['ZOM','ZOMBI','GAME','FAST','WIN','DISCORD','ECONOMY','PLAYER'],
  dailyQuestions: [
    { question:'كم عدد ساعات اليوم؟', answer:'24' },
    { question:'كم عدد دقائق الساعة؟', answer:'60' },
    { question:'كم عدد أيام الأسبوع؟', answer:'7' }
  ]
};

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function cleanText(v,max){ return String(v??'').trim().slice(0,max); }
function normalizeQA(items,maxItems){
  return (Array.isArray(items)?items:[]).slice(0,maxItems).map(x=>({question:cleanText(x?.question,500),answer:cleanText(x?.answer,120)})).filter(x=>x.question&&x.answer);
}
function normalizeGameContent(input={}, maxItems=1000){
  const quiz=normalizeQA(input.quizQuestions,maxItems);
  const tf=normalizeQA(input.trueFalseQuestions,maxItems).map(x=>({...x,answer:['صح','خطأ'].includes(x.answer)?x.answer:'صح'}));
  const words=(Array.isArray(input.wordQuestions)?input.wordQuestions:[]).slice(0,maxItems).map(x=>({scrambled:cleanText(x?.scrambled,120),answer:cleanText(x?.answer,120)})).filter(x=>x.scrambled&&x.answer);
  const speed=(Array.isArray(input.speedWords)?input.speedWords:[]).slice(0,maxItems).map(x=>cleanText(x,80)).filter(Boolean);
  const daily=normalizeQA(input.dailyQuestions,maxItems);
  return {
    quizQuestions:quiz.length?quiz:clone(DEFAULT_GAME_CONTENT.quizQuestions),
    trueFalseQuestions:tf.length?tf:clone(DEFAULT_GAME_CONTENT.trueFalseQuestions),
    wordQuestions:words.length?words:clone(DEFAULT_GAME_CONTENT.wordQuestions),
    speedWords:speed.length?speed:clone(DEFAULT_GAME_CONTENT.speedWords),
    dailyQuestions:daily.length?daily:clone(DEFAULT_GAME_CONTENT.dailyQuestions)
  };
}

module.exports={DEFAULT_GAME_CONTENT,normalizeGameContent,clone};
