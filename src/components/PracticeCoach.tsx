import React from 'react';
import type {ClientProjectedGameState,CharacterId} from '../types/game';
import {CHARACTERS} from '../game/rules/characters';
export const PracticeCoach:React.FC<{view:ClientProjectedGameState;selectedCardId:string|null;claimedCharacter:CharacterId}>=({view,selectedCardId,claimedCharacter})=>{
 const me=view.viewerPlayerId,current=view.players[view.currentPlayerIndex];
 const card=view.myHand.find(c=>c.id===selectedCardId);
 let message='',example='';
 if(view.phase==='CHOOSING_MOVE'){
  if(current.id===me){message='اختر بطاقة من يدك، ثم اختر الاسم اللي بتقوله، واضغط زر اللعب. خذ وقتك.';
   if(card)example=`بطاقتك «${CHARACTERS[card.characterId].nameAr}»، وبتقول «${CHARACTERS[claimedCharacter].nameAr}»: هذا ${card.characterId===claimedCharacter?'صدق':'خداع'}.`;
  }else message=`دور ${current.name}. انتظر يشوف وش بيلعب، وبعدها تقدر تتحداه.`;
 }else if(view.phase==='CHALLENGE_WINDOW'){
  if(view.pendingClaimPublic?.playerId===me)message='حطيت بطاقتك مقلوبة. الحين الخصوم يقررون: يصدقونك أو يضغطون «صادوه!».';
  else{message='تشك إنه يخدعك؟ اضغط «صادوه!». تصدقه؟ اضغط «عدّها له». الوقت واقف لك في التدريب.';if(view.pendingClaimPublic)example=`الاسم اللي قاله: «${CHARACTERS[view.pendingClaimPublic.claimedCharacter].nameAr}». بطاقته الحقيقية ما نعرفها إلا إذا تحدّيته.`;}
 }else if(view.phase==='RESOLVING_CHALLENGE'){
  const result=view.lastOutcomePublic;
  message=!result?.challenged?'محد تحدّى اللاعب، فنطبق حركة الشخصية اللي قالها.':result.wasTruthful?'طلع صادق! اللي ضغط «صادوه!» يسحب بطاقة.':'طلع يخدعهم! صاحب البطاقة يسحب بطاقة، وحركته ما تشتغل.';
  example='اقرأ النتيجة، ثم اضغط «قرأت النتيجة — الدور التالي».';
 }else message=view.winnerPlayerId===me?'كفو! خلصت بطاقاتك وفزت. تقدر الآن تجرب مباراة عادية.':'انتهى التدريب. تقدر تعيد التجربة، أو ترجع للقائمة.';
 return <aside className="practice-coach" aria-label="شرح أثناء اللعب"><strong> الحين وش أسوي؟</strong><p>{message}</p>{example&&<p className="practice-coach-example">{example}</p>}<small>تدريب مع الشرح • ما يحسب ضمن نتائجك</small></aside>;
};
