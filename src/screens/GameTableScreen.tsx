import {t,fmt,tr} from '../i18n/translate';
import {loadUserSettings} from '../services/storage/localSettings';
import {useTransitionPause} from '../services/useTransitionPause';
import {getRoundNumber} from '../services/feedbackEvents';
import {GameFeedback,RevealCard,useDrawFeedback} from '../components/Feedback';
import {BrandLogo,ThemeToggle} from '../components/Theme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BotDifficulty,
  CharacterId,
  ChatMessage,
  GameState,
  ClientProjectedGameState,
} from '../types/game';
import { CHARACTER_LIST, CHARACTERS } from '../game/rules/characters';
import { CHALLENGE_TIMER_SECONDS, BOT_MOVE_DELAY_MS, BOT_CHALLENGE_DELAY_MS, CHAT_BUBBLE_MS } from '../game/rules/deck';
import {
  advanceToNextTurn,
  createMatch,
  executeAutoTimeoutMove,
  resolveChallengeWindow,
  submitPlayerMove,
} from '../game/engine/gameEngine';
import { projectGameStateForPlayer } from '../game/engine/stateProjector';
import { decideBotChallenge, decideBotMove } from '../game/bots/localBotEngine';
import { BOT_MOVE_CHAT_PHRASES } from '../game/bots/botPhrases';
import { CardView } from '../components/CardView';
import { PlayerSeat } from '../components/PlayerSeat';
import { ChatDrawer } from '../components/ChatDrawer';
import { ActionLogModal } from '../components/ActionLogModal';
import { PracticeCoach } from '../components/PracticeCoach';

import type { SupabaseRoomService } from '../services/multiplayer/roomClient';

interface GameTableScreenProps {
  remote?: { service: SupabaseRoomService; view: ClientProjectedGameState };
  guided?: boolean;
  humanPlayerName: string;
  botCount: number;
  botDifficulty: BotDifficulty;
  onExitToMenu: () => void;
  onRecordMatchEnd: (humanWon: boolean) => void;
  feedbackSilent?: boolean;
  freshRemoteStart?: boolean;
}



export const GameTableScreen: React.FC<GameTableScreenProps> = ({
  remote,
  feedbackSilent=false,
  freshRemoteStart=false,
  guided = false,
  humanPlayerName,
  botCount,
  botDifficulty,
  onExitToMenu,
  onRecordMatchEnd,
}) => {
  const HUMAN_ID = remote?.view.viewerPlayerId || 'player_human';
  const [gameState, setGameState] = useState<GameState>(() =>
    createMatch({
      moveDurationSeconds:loadUserSettings().turnDurationSeconds,
      humanPlayerName,
      botCount,
      botDifficulty,
    })
  );

  // اختيارات اللاعب البشري في دوره
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedClaimChar, setSelectedClaimChar] = useState<CharacterId>('sanad');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedSecondaryCardId, setSelectedSecondaryCardId] = useState<string | null>(null);
  const [showBluff,setShowBluff]=useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // نوافذ الشات والسجل
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // فقاعات الشات العائمة فوق مقاعد اللاعبين لمدة 4 ثوانٍ
  const [seatBubbles, setSeatBubbles] = useState<Record<string, string>>({});
  const bubbleTimersRef = useRef<Record<string, number>>({});
  const matchRecordedRef = useRef<boolean>(false);

  // إسقاط الحالة للاعب البشري (يخفي بطاقات الخصوم وبطاقة الطاولة المقلوبة!)
  const view = useMemo(
    () => remote?.view || projectGameStateForPlayer(gameState, HUMAN_ID),
    [gameState, remote?.view]
  );

  const transitionPaused=useTransitionPause(view,!!remote);
  useDrawFeedback(view.drawPileCount,view.matchId,feedbackSilent);
  const activePlayer = view.players[view.currentPlayerIndex];
  const isMyTurn = activePlayer?.id === HUMAN_ID;
  const opponents = view.players.filter((p) => p.id !== HUMAN_ID);
  const practicePaused = guided && !remote && (
    (view.phase === 'CHOOSING_MOVE' && isMyTurn) ||
    (view.phase === 'CHALLENGE_WINDOW' && view.pendingClaimPublic?.playerId !== HUMAN_ID)
  );

  // إظهار فقاعة نصية فوق مقعد اللاعب لمدة 4 ثوانٍ
  const showBubbleForPlayer = useCallback((playerId: string, text: string) => {
    setSeatBubbles((prev) => ({ ...prev, [playerId]: text }));
    if (bubbleTimersRef.current[playerId]) {
      window.clearTimeout(bubbleTimersRef.current[playerId]);
    }
    bubbleTimersRef.current[playerId] = window.setTimeout(() => {
      setSeatBubbles((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    }, CHAT_BUBBLE_MS);
  }, []);

  // ضبط الاختيارات الافتراضية عند بداية دور اللاعب البشري
  useEffect(() => {
    if (view.phase === 'CHOOSING_MOVE' && isMyTurn && view.myHand.length > 0) {
      const firstCard = view.myHand[0];
      setSelectedCardId(firstCard.id);
      setShowBluff(false);
      setSelectedClaimChar(firstCard.characterId);
      const validOpponents = opponents.filter((o) => o.cardCount > 0);
      setSelectedTargetId(
        validOpponents.length > 0
          ? validOpponents[0].id
          : opponents[0]?.id ?? null
      );
      const secondCard = view.myHand.find((c) => c.id !== firstCard.id);
      setSelectedSecondaryCardId(secondCard ? secondCard.id : null);
      setUiError(null);
    }
  }, [view.phase, view.turnNumber, isMyTurn]);

  // تسجيل نتيجة المباراة عند انتهائها
  useEffect(() => {
    if (view.phase === 'GAME_OVER' && view.winnerPlayerId && !matchRecordedRef.current) {
      matchRecordedRef.current = true;

      onRecordMatchEnd(view.winnerPlayerId === HUMAN_ID);
    }
  }, [view.phase, view.winnerPlayerId, onRecordMatchEnd]);

  // عداد الوقت (15 ثانية لاختيار الحركة، و5 ثوانٍ لنافذة التحدي)
  useEffect(() => {
    if (remote || practicePaused || transitionPaused) return;
    if (gameState.phase !== 'CHOOSING_MOVE' && gameState.phase !== 'CHALLENGE_WINDOW') {
      return;
    }

    const interval = window.setInterval(() => {
      setGameState((prev) => {
        if (prev.phase === 'CHOOSING_MOVE') {
          if (prev.turnTimerSeconds > 1) {
            return { ...prev, turnTimerSeconds: prev.turnTimerSeconds - 1 };
          }
          // انتهى وقت الـ 15 ثانية -> تنفيذ حركة قانونية تلقائية

          return executeAutoTimeoutMove(prev);
        }

        if (prev.phase === 'CHALLENGE_WINDOW') {
          if (prev.turnTimerSeconds > 1) {
            return { ...prev, turnTimerSeconds: prev.turnTimerSeconds - 1 };
          }
          // انتهى عداد الـ 5 ثوانٍ دون تحدٍّ -> تسوية الحركة
          return resolveChallengeWindow(prev, null);
        }

        return prev;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [gameState.phase, gameState.turnNumber, practicePaused,transitionPaused]);

  // ذكاء الخصوم الآليين في اختيار الحركة عندما يكون الدور على بوت
  useEffect(() => {
    if (remote || transitionPaused) return;
    if (gameState.phase !== 'CHOOSING_MOVE') return;
    const current = gameState.players[gameState.currentPlayerIndex];
    if (!current || !current.isBot) return;

    const botDelay = window.setTimeout(() => {
      setGameState((prev) => {
        if (prev.phase !== 'CHOOSING_MOVE') return prev;
        const botPlayer = prev.players[prev.currentPlayerIndex];
        if (!botPlayer || !botPlayer.isBot) return prev;

        // البوت يرى فقط حالته المسقطة القانونية وذاكرته القانونية!
        const botProjected = projectGameStateForPlayer(prev, botPlayer.id);
        const botMemory = prev.botMemories[botPlayer.id];
        const move = decideBotMove(
          botProjected,
          botMemory,
          botPlayer.botDifficulty ?? botDifficulty
        );

        const res = submitPlayerMove(prev, move);

        // عبارة سعودية خفيفة من البوت فوق مقعده
        const isTruth =
          botPlayer.hand.find((c) => c.id === move.cardId)?.characterId ===
          move.claimedCharacter;
        const pool = isTruth
          ? BOT_MOVE_CHAT_PHRASES.truthful
          : BOT_MOVE_CHAT_PHRASES.bluffing;
        const phrase = pool[Math.floor(Math.random() * pool.length)];
        showBubbleForPlayer(botPlayer.id, phrase);

        return res.nextState;
      });
    }, BOT_MOVE_DELAY_MS);

    return () => window.clearTimeout(botDelay);
  }, [
    gameState.phase,
    gameState.currentPlayerIndex,
    gameState.turnNumber,
    botDifficulty,
    transitionPaused,
    showBubbleForPlayer,
  ]);

  // ذكاء الخصوم الآليين في نافذة التحدي (5 ثوانٍ): هل يضغط أحد البوتات «صادوه!»؟
  useEffect(() => {
    if (remote || practicePaused || transitionPaused) return;
    if (gameState.phase !== 'CHALLENGE_WINDOW' || !gameState.pendingClaim) return;

    const botChallengers = gameState.players.filter(
      (p) => p.isBot && p.id !== gameState.pendingClaim?.playerId
    );

    const timer = window.setTimeout(() => {
      setGameState((prev) => {
        if (prev.phase !== 'CHALLENGE_WINDOW' || !prev.pendingClaim) return prev;

        for (const bot of botChallengers) {
          const botProjected = projectGameStateForPlayer(prev, bot.id);
          const botMem = prev.botMemories[bot.id];
          const wantsChallenge = decideBotChallenge(
            botProjected,
            botMem,
            bot.botDifficulty ?? botDifficulty
          );
          if (wantsChallenge) {

            const phrase =
              BOT_MOVE_CHAT_PHRASES.challenge[
                Math.floor(Math.random() * BOT_MOVE_CHAT_PHRASES.challenge.length)
              ];
            showBubbleForPlayer(bot.id, phrase);
            return resolveChallengeWindow(prev, bot.id);
          }
        }
        return prev;
      });
    }, BOT_CHALLENGE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    gameState.phase,
    gameState.turnNumber,
    botDifficulty,
    transitionPaused,
    showBubbleForPlayer,
    practicePaused,
  ]);

  // في اللعب الفردي تبقى النتيجة حتى يؤكد اللاعب أنه انتهى من قراءتها.
  // في اللعب الجماعي يدير الخادم مهلة القراءة المشتركة.

  // تأكيد حركة اللاعب البشري
  const handleConfirmMove = () => {
    if(transitionPaused)return;
    if (remote) { if(selectedCardId) remote.service.sendEvent({type:'SUBMIT_MOVE',payload:{cardId:selectedCardId,claimedCharacter:selectedClaimChar,targetPlayerId:CHARACTERS[selectedClaimChar].requiresTarget?selectedTargetId:null,secondaryCardId:selectedSecondaryCardId}}); return; }
    if (!selectedCardId) {
      setUiError(t("اختر بطاقة حقيقية من يدك أولًا!"));
      return;
    }
    const charDef = CHARACTERS[selectedClaimChar];
    if (charDef.requiresTarget && !selectedTargetId) {
      setUiError(t("اختر خصمًا مستهدفًا من حول الطاولة لهذه القدرة!"));
      return;
    }

    const res = submitPlayerMove(gameState, {
      playerId: HUMAN_ID,
      cardId: selectedCardId,
      claimedCharacter: selectedClaimChar,
      targetPlayerId: charDef.requiresTarget ? selectedTargetId : null,
      secondaryCardId: selectedSecondaryCardId,
    });

    if (res.errorAr) {
      setUiError(res.errorAr);
      return;
    }

    setUiError(null);
    setGameState(res.nextState);
  };

  // ضغط اللاعب البشري على زر «صادوه!»
  const handleHumanPressSadooh = () => {
    if(remote){remote.service.sendEvent({type:'PRESS_SADOOH',payload:{matchId:view.matchId,turnNumber:view.turnNumber}});return;}
    if (
      gameState.phase !== 'CHALLENGE_WINDOW' ||
      !gameState.pendingClaim ||
      gameState.pendingClaim.playerId === HUMAN_ID
    ) {
      return;
    }

    showBubbleForPlayer(HUMAN_ID, t("صادوه! اكشف البطاقة! "));
    setGameState((prev) => resolveChallengeWindow(prev, HUMAN_ID));
  };

  // تمرير التحدي من اللاعب البشري (تخطي انتظار الـ5 ثوانٍ إذا لم يرغب في التحدي)
  const handleHumanPassChallenge = () => {
    if(remote){remote.service.sendEvent({type:'PASS_CHALLENGE',payload:{matchId:view.matchId,turnNumber:view.turnNumber}});return;}
    if (remote || transitionPaused) return;
    if (gameState.phase !== 'CHALLENGE_WINDOW') return;
    setGameState((prev) => resolveChallengeWindow(prev, null));
  };

  // بدء مباراة جديدة
  const handleRestartMatch = () => {
    if(remote){remote.service.sendEvent({type:'START_MATCH',payload:{roomCode:remote.service.getState().roomCode}});return;}
    matchRecordedRef.current = false;
    setGameState(
      createMatch({
        moveDurationSeconds:loadUserSettings().turnDurationSeconds,
      humanPlayerName,
        botCount,
        botDifficulty,
      })
    );
  };

  // إرسال رسالة شات داخل المباراة
  const handleSendChat = (text: string, isQuickReaction?: boolean) => {
    if(remote){remote.service.sendEvent({type:'SEND_CHAT',payload:{text,isQuickReaction}});return;}
    const newMsg: ChatMessage = {
      id: `chat_${Date.now()}`,
      senderId: HUMAN_ID,
      senderName: humanPlayerName,
      text,
      isQuickReaction,
      timestamp: Date.now(),
    };
    setGameState((prev) => ({
      ...prev,
      chatMessages: [...prev.chatMessages, newMsg],
    }));
    showBubbleForPlayer(HUMAN_ID, text);
  };

  const claimedCharDef = view.pendingClaimPublic
    ? CHARACTERS[view.pendingClaimPublic.claimedCharacter]
    : null;
  const claimSpeaker = view.pendingClaimPublic
    ? view.players.find((p) => p.id === view.pendingClaimPublic?.playerId)
    : null;
  const claimTarget =
    view.pendingClaimPublic?.targetPlayerId
      ? view.players.find((p) => p.id === view.pendingClaimPublic?.targetPlayerId)
      : null;

  const needsTargetForSelection =
    isMyTurn &&
    view.phase === 'CHOOSING_MOVE' &&
    CHARACTERS[selectedClaimChar].requiresTarget;

  const needsSecondaryCardPicker =
    isMyTurn &&
    view.phase === 'CHOOSING_MOVE' &&
    (selectedClaimChar === 'mosarref' || selectedClaimChar === 'mokhabbes') &&
    view.myHand.length >= 2;

  const myPublicProfile = view.players.find((p) => p.id === HUMAN_ID)!;

  return (
    <div
      className="game-table-screen"
      style={{ backgroundImage: `url('./assets/game-table.svg')` }}
    >
      <div className="game-table-overlay">
        {/* الشريط العلوي للمباراة */}
        <header className="table-topbar">
          <div className="table-topbar__brand">
            <GameFeedback state={view} remote={!!remote} silent={feedbackSilent} freshRemoteStart={freshRemoteStart}/><BrandLogo onHome={onExitToMenu} alt={t("صادوه!")} className="table-topbar__logo" />
            <div className="table-topbar__meta">
              <span className="turn-badge">{""+t("الجولة #")+""}{tr(getRoundNumber(view.turnNumber,view.players.length))}</span>
              <span className="deck-pill"> {" "+t("السحب:")+" "}{tr(view.drawPileCount)}</span>
              <span className="deck-pill"> {" "+t("المستخدمة:")+" "}{tr(view.discardPileCount)}</span>
            </div>
          </div>

          {/* المؤقت الزمني للدور أو نافذة التحدي */}
          <div className="table-topbar__timer">
            {tr(view.phase === 'CHOOSING_MOVE' && (
              <div className="timer-pill timer-pill--move">
                <span>{t("الدور:")} <bdi>{activePlayer?.name}</bdi></span>
                <strong>{tr(practicePaused ? t("خذ وقتك") : fmt("{0} ث",[view.turnTimerSeconds]))}</strong>
              </div>
            ))}
            {tr(view.phase === 'CHALLENGE_WINDOW' && (
              <div className="timer-pill timer-pill--challenge">
                <span> {" "+t("مهلة تحدي «صادوه!»:")+""}</span>
                <strong>{tr(practicePaused ? t("خذ وقتك") : fmt("{0} ث",[view.turnTimerSeconds]))}</strong>
              </div>
            ))}
          </div>

          <details className="table-more"><summary>{""+t("المزيد")+""}</summary><div className="table-topbar__actions"><ThemeToggle/>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setIsChatOpen(true)}
            >
               {" "+t("الشات (")+""}{tr(view.chatMessages.length)})
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setIsLogOpen(true)}
            >
               {" "+t("السجل (")+""}{tr(view.logs.length)})
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={onExitToMenu}>
               {" "+t("خروج")+" "}</button>
          </div></details>
        </header>

        {tr(guided && !remote && <PracticeCoach view={view} selectedCardId={selectedCardId} claimedCharacter={selectedClaimChar} />)}

        {/* مقاعد الخصوم حول الطاولة */}
        <section className="opponents-ring" aria-label={t("الخصوم حول الطاولة")}>
          {tr(opponents.map((opp) => (
            <PlayerSeat
              key={opp.id}
              player={opp}
              isCurrentTurn={activePlayer?.id === opp.id}
              isTargetable={needsTargetForSelection}
              isSelectedTarget={selectedTargetId === opp.id}
              onSelectTarget={(id) => setSelectedTargetId(id)}
              bubbleText={seatBubbles[opp.id] ?? null}
            />
          )))}
        </section>

        {/* وسط طاولة الاستراحة (البطاقة المقلوبة، الادعاء، زر صادوه، ونتيجة الجولة) */}
        <main className="table-center-stage">
          {tr(view.phase === 'CHOOSING_MOVE' && (
            <div className="center-status-box">
              {tr(isMyTurn ? (
                <>
                    <h3> {" "+t("دورك الآن!")+" "}{tr(practicePaused ? t("خذ وقتك") : fmt("({0} ثانية)",[view.turnTimerSeconds]))}</h3>
                  <p>
                    {" "+t("اختر بطاقة، وقل اسمها أو غيّره للخداع.")+" "}</p>
                </>
              ) : (
                <>
                  <h3><bdi>{activePlayer?.name}</bdi> {t("يفكر في حركته...")}</h3>
                  <p>{tr(guided ? t("استعد! أول ما يحط بطاقته مقلوبة، بتقرر: تصدقه أو تضغط «صادوه!». بنشرح لك وقتها.") : fmt("استعد! أول ما يحط بطاقته مقلوبة، قدامك {0} ثانية تقرر تصدقه ولا تصيده!",[CHALLENGE_TIMER_SECONDS]))}</p>
                </>
              ))}
            </div>
          ))}

          {tr(view.phase === 'CHALLENGE_WINDOW' && view.pendingClaimPublic && claimedCharDef && (
            <div className="challenge-stage-card">
              <div className="challenge-stage-card__visual">
                {/* البطاقة المقلوبة في وسط الطاولة (تظل سرية!) */}
                <CardView faceDown size="md" badgeText={t("بطاقة مقلوبة")} />
              </div>

              <div className="challenge-stage-card__details">
                <div className="claim-announcement-badge">
                  <span> {" "+t("إعلان على الطاولة:")+""}</span>
                  <h3>
                    <bdi>{claimSpeaker?.name}</bdi> {t("يدّعي أنه يلعب")}{tr(' ')}
                    <strong style={{ color: claimedCharDef.accentColor }}>
                      {tr(claimedCharDef.nameAr)}
                    </strong>
                    {tr(claimTarget ? fmt(" ضد «{0}»",[claimTarget.name]) : '')}!
                  </h3>
                  <p className="claim-ability-line">{tr(claimedCharDef.descriptionAr)}</p>
                </div>

                {tr(view.hasPassedChallenge ? <p className="party-passed">{""+t("عدّيتها. ننتظر قرار الباقين.")+""}</p> : view.pendingClaimPublic.playerId !== HUMAN_ID ? (
                  <div className="challenge-cta-group">
                    <button
                      type="button"
                      className="btn-sadooh-mega"
                      onClick={handleHumanPressSadooh}
                    >
                       {" "+t("صادوه!")+" "}{tr(practicePaused ? t("(اكشف بطاقته)") : fmt("({0} ث)",[view.turnTimerSeconds]))}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleHumanPassChallenge}
                    >
                       {" "+t("عدّها له (لا أتحدى)")+" "}</button>
                  </div>
                ) : (
                  <div className="waiting-opponents-challenge">
                    <span> {" "+t("الخصوم ينظرون في عيونك... هل يضغط أحدهم «صادوه!»؟ (")+""}{tr(view.turnTimerSeconds)} {" "+t("ث)")+""}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {tr(view.phase === 'RESOLVING_CHALLENGE' && view.lastOutcomePublic && (
            <div className="outcome-stage-card" role="status">
              <div className="outcome-stage-card__card-slot">
                {tr(view.lastOutcomePublic.revealedCard ? (
                  <RevealCard
                    silent={feedbackSilent}
                    eventKey={`${view.matchId}:${view.turnNumber}:public-flip`}
                    characterId={view.lastOutcomePublic.revealedCard.characterId}
                    badgeText={tr(view.lastOutcomePublic.wasTruthful
                        ? t(" طلع صادق!")
                        : t(" طلع كذاب!"))}
                  />
                ) : (
                  <CardView
                    faceDown
                    size="sm"
                    badgeText={t(" بقيت البطاقة سرية")}
                  />
                ))}
              </div>

              <div className="outcome-stage-card__info">
                <span className="outcome-funny-quote">
                  «{tr(view.lastOutcomePublic.funnyQuoteAr)}»
                </span>
                <p className="outcome-summary-text">
                  {tr(view.lastOutcomePublic.summaryAr)}
                </p>

                {/* نافذة الكشف السري الخاصة بقدرة «الملقوف» (تظهر فقط للاعب الذي استخدم القدرة!) */}
                {tr(view.lastOutcomePublic.myPrivateReveal && (
                  <div className="private-malqoof-reveal">
                    <div>
                      <strong> {" "+t("كشف «الملقوف» السري (تراه أنت فقط):")+""}</strong>
                      <p>
                        {" "+t("كشفت سرًا هذه البطاقة في يد «")+" "}{tr(view.players.find(
                            (p) =>
                              p.id ===
                              view.lastOutcomePublic?.myPrivateReveal?.targetPlayerId
                          )?.name)}
                        »:
                      </p>
                    </div>
                    <CardView
                      characterId={
                        view.lastOutcomePublic.myPrivateReveal.revealedCard.characterId
                      }
                      size="sm"
                      badgeText={t("سري لك فقط")}
                    />
                  </div>
                ))}

                <div className="outcome-next-row">
                  {tr(remote ? (
                    <span> {" "+t("اقرأ النتيجة بهدوء — الدور التالي بعد")+" "}{tr(view.turnTimerSeconds)} {" "+t("ثانية")+""}</span>
                  ) : <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => setGameState((prev) => advanceToNextTurn(prev))}
                  >
                    {" "+t("قرأت النتيجة — الدور التالي")+" "}</button>)}
                </div>
              </div>
            </div>
          ))}
        </main>

        {/* منطقة اللاعب البشري أسفل الشاشة (بطاقات اليد + لوحة إعلان الشخصية والهدف) */}
        <section className="human-player-dock" aria-label={t("منطقة بطاقاتك وحركتك")}>
          {seatBubbles[HUMAN_ID] && (
            <div className="human-chat-bubble">{seatBubbles[HUMAN_ID]}</div>
          )}

          <div className="human-dock-header">
            <div className="human-status-info">
              <strong> {myPublicProfile?.name} {" "+t("(أنت)")+""}</strong>
              <span className="my-card-count-badge">
                {" "+t("بطاقات يدك:")+" "}{tr(view.myHand.length)}
              </span>
              {tr(myPublicProfile?.hasSanadShield && (
                <span className="sanad-active-pill"> {" "+t("محمي بدرع السند")+""}</span>
              ))}
            </div>

            {tr(uiError && <div className="dock-error-pill"> {tr(uiError)}</div>)}
          </div>

          <div className="human-dock-layout">
            {/* بطاقات يد اللاعب الخاصة */}
            <div className="human-hand-scroll">
              {tr(view.myHand.length === 0 ? (
                <div className="empty-hand-notice">
                  {" "+t("لا توجد بطاقات في يدك حاليًا!")+" "}</div>
              ) : (
                view.myHand.map((card) => {
                  const isMainSelected = selectedCardId === card.id;
                  const isSecondarySelected =
                    needsSecondaryCardPicker && selectedSecondaryCardId === card.id;
                  return (
                    <CardView
                      key={card.id}
                      characterId={card.characterId}
                      size="md"
                      selected={isMainSelected}
                      disabled={!isMyTurn || view.phase !== 'CHOOSING_MOVE'}
                      badgeText={tr(isMainSelected
                          ? t("البطاقة الملعوبة")
                          : isSecondarySelected
                          ? t("بطاقة القدرة الإضافية")
                          : undefined)}
                      onClick={() => {
                        setSelectedCardId(card.id);
                        setSelectedClaimChar(card.characterId);setShowBluff(false);
                        if (selectedSecondaryCardId === card.id) {
                          const other = view.myHand.find((c) => c.id !== card.id);
                          setSelectedSecondaryCardId(other ? other.id : null);
                        }
                      }}
                    />
                  );
                })
              ))}
            </div>

            {/* لوحة اختيار الشخصية المعلنة والهدف عندما يكون الدور على اللاعب */}
            {tr(isMyTurn && view.phase === 'CHOOSING_MOVE' && (
              <div className="move-controls-panel">
                <div className="control-group simple-move-choice">
                  <span className="control-label">{""+t("بتقول:")+" "}<strong>{tr(CHARACTERS[selectedClaimChar].nameAr)}</strong></span>
                  <p className="selected-ability">{tr(CHARACTERS[selectedClaimChar].descriptionAr)}</p>
                  <button type="button" className="btn-secondary btn-sm" aria-expanded={showBluff} onClick={()=>setShowBluff(!showBluff)}>{tr(showBluff?t("إخفاء الأسماء"):t("تبي تخدعهم؟ غيّر الاسم"))}</button>
                  {tr(showBluff&&<label className="bluff-select">{""+t("وش بتقول لهم؟")+""}<select value={selectedClaimChar} onChange={e=>setSelectedClaimChar(e.target.value as CharacterId)}>{tr(CHARACTER_LIST.map(c=><option value={c.id} key={c.id}>{tr(c.nameAr)}{tr(view.myHand.find(c=>c.id===selectedCardId)?.characterId===c.id?t(" — صدق"):t(" — خداع"))}</option>))}</select></label>)}
                </div>
                {needsTargetForSelection&&<label className="bluff-select">{""+t("على مين؟")+""}<select value={selectedTargetId||''} onChange={e=>setSelectedTargetId(e.target.value)}>{opponents.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}

                {tr(needsSecondaryCardPicker && (
                  <div className="control-group">
                    <span className="control-label">
                      {tr(selectedClaimChar === 'mosarref'
                        ? t("بطاقة يدك الإضافية لتصريفها (إن لم تكن الأخيرة):")
                        : t("بطاقة يدك لتبديلها بالمخبّص:"))}
                    </span>
                    <div className="target-chips-row">
                      {tr(view.myHand
                        .filter((c) => c.id !== selectedCardId)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`target-chip ${
                              selectedSecondaryCardId === c.id ? 'is-active' : ''
                            }`}
                            onClick={() => setSelectedSecondaryCardId(c.id)}
                          >
                             {tr(CHARACTERS[c.characterId].nameAr)}
                          </button>
                        )))}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn-primary btn-play-confirm"
                  disabled={transitionPaused}
                  onClick={handleConfirmMove}
                >
                   {t("العب وقل:")} <bdi>{t(CHARACTERS[selectedClaimChar].nameAr)}</bdi>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* شاشة الفوز والاحتفال عند انتهاء المباراة */}
        {tr(view.phase === 'GAME_OVER' && view.winnerPlayerId && (
          <div className="modal-backdrop">
            <div className="victory-modal" role="dialog" aria-label={t("نتيجة المباراة")}>
              <div className="victory-confetti">    </div>
              <img
                src={
                  view.players.find((p) => p.id === view.winnerPlayerId)?.avatarAsset.replace(/\.png$/, '.svg') ||
                  './assets/abu-fahad.svg'
                }
                alt={t("الفائز")}
                className="victory-avatar"
              />
              <h2>
                {tr(view.winnerPlayerId === HUMAN_ID
                  ? t(" كفو يا وحش! فزت بالجلسة!")
                  : fmt(" فاز «{0}» بالمباراة!",[view.players.find((p) => p.id === view.winnerPlayerId)?.name]))}
              </h2>
              <p className="victory-subtitle">
                {tr(view.winnerPlayerId === HUMAN_ID
                  ? t("أبو فهد: «يا ساتر، شكلك صرت محترف رسمي! صفيت أوراقك كلها بنظام وذكاء!»")
                  : t("أبو فهد: «خيرها بغيرها يا بطل! الجلسة الجاية رد اعتبارك واصفطهم!»"))}
              </p>

              <div className="victory-standings"><h3>{t("الترتيب النهائي")}</h3>
                {tr(view.players.slice().sort((a,b)=>a.id===view.winnerPlayerId?-1:b.id===view.winnerPlayerId?1:a.cardCount-b.cardCount).map((p,i) => (
                  <div key={p.id} className="standing-row feedback-result-row" style={{'--row-delay': `${i*70}ms`} as React.CSSProperties}>
                    <span>
                      {tr(p.id === view.winnerPlayerId ? ' ' : '• ')}
                      {p.name}
                    </span>
                    <strong>
                      {tr(p.cardCount === 0 && p.id === view.winnerPlayerId
                        ? t("فائز (0 بطاقات)")
                        : fmt("{0} بطاقات متبقية",[p.cardCount]))}
                    </strong>
                  </div>
                )))}
              </div>

              <div className="victory-actions">
                <button
                  type="button"
                  className="btn-primary btn-lg"
                  onClick={handleRestartMatch}
                >
                   {" "+t("العب مباراة جديدة")+" "}</button>
                <button
                  type="button"
                  className="btn-secondary btn-lg"
                  onClick={onExitToMenu}
                >
                   {" "+t("القائمة الرئيسية")+" "}</button>
              </div>
            </div>
          </div>
        ))}

        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={view.chatMessages}
          players={view.players}
          viewerPlayerId={HUMAN_ID}
          onSendMessage={handleSendChat}
          onToggleMutePlayer={(targetId) => {
            if(remote){remote.service.sendEvent({type:'MUTE_PLAYER',payload:{targetPlayerId:targetId,muted:!view.players.find(p=>p.id===targetId)?.isMuted}});return;}
            setGameState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.id === targetId ? { ...p, isMuted: !p.isMuted } : p
              ),
            }));
          }}
          onReportPlayer={(targetPlayerId,reason) => {remote?.service.sendEvent({type:'REPORT_ABUSE',payload:{targetPlayerId,reason}});}}
        />

        <ActionLogModal
          isOpen={isLogOpen}
          logs={view.logs}
          onClose={() => setIsLogOpen(false)}
        />
      </div>
    </div>
  );
};
