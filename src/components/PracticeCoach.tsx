import {t,fmt,tr} from '../i18n/translate';
import React from 'react';
import type {ClientProjectedGameState,CharacterId} from '../types/game';
import {CHARACTERS} from '../game/rules/characters';
export const PracticeCoach:React.FC<{view:ClientProjectedGameState;selectedCardId:string|null;claimedCharacter:CharacterId}>=({view,selectedCardId,claimedCharacter})=>{
 const me=view.viewerPlayerId,current=view.players[view.currentPlayerIndex];
 const card=view.myHand.find(c=>c.id===selectedCardId);
 let message='',example='';
 if(view.phase==='CHOOSING_MOVE'){
  if(current.id===me){message=t("اختر بطاقة من يدك، ثم اختر الاسم اللي بتقوله، واضغط زر اللعب. خذ وقتك.");
   if(card)example=fmt("بطاقتك «{0}»، وبتقول «{1}»: هذا {2}.",[CHARACTERS[card.characterId].nameAr,CHARACTERS[claimedCharacter].nameAr,card.characterId===claimedCharacter?t("صدق"):t("خداع")]);
  }else message=fmt("دور {0}. انتظر يشوف وش بيلعب، وبعدها تقدر تتحداه.",[current.name]);
 }else if(view.phase==='CHALLENGE_WINDOW'){
  if(view.pendingClaimPublic?.playerId===me)message=t("حطيت بطاقتك مقلوبة. الحين الخصوم يقررون: يصدقونك أو يضغطون «صادوه!».");
  else{message=t("تشك إنه يخدعك؟ اضغط «صادوه!». تصدقه؟ اضغط «عدّها له». الوقت واقف لك في التدريب.");if(view.pendingClaimPublic)example=fmt("الاسم اللي قاله: «{0}». بطاقته الحقيقية ما نعرفها إلا إذا تحدّيته.",[CHARACTERS[view.pendingClaimPublic.claimedCharacter].nameAr]);}
 }else if(view.phase==='RESOLVING_CHALLENGE'){
  const result=view.lastOutcomePublic;
  message=!result?.challenged?t("محد تحدّى اللاعب، فنطبق حركة الشخصية اللي قالها."):result.wasTruthful?t("طلع صادق! اللي ضغط «صادوه!» يسحب بطاقة."):t("طلع يخدعهم! صاحب البطاقة يسحب بطاقة، وحركته ما تشتغل.");
  example=t("اقرأ النتيجة، ثم اضغط «قرأت النتيجة — الدور التالي».");
 }else message=view.winnerPlayerId===me?t("كفو! خلصت بطاقاتك وفزت. تقدر الآن تجرب مباراة عادية."):t("انتهى التدريب. تقدر تعيد التجربة، أو ترجع للقائمة.");
 return <aside className="practice-coach" aria-label={t("شرح أثناء اللعب")}><strong> {" "+t("الحين وش أسوي؟")+""}</strong><p>{tr(message)}</p>{tr(example&&<p className="practice-coach-example">{tr(example)}</p>)}<small>{""+t("تدريب مع الشرح • ما يحسب ضمن نتائجك")+""}</small></aside>;
};
