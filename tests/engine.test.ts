import {
  advanceToNextTurn,
  createMatch,
  executeAutoTimeoutMove,
  resolveChallengeWindow,
  submitPlayerMove,
} from '../src/game/engine/gameEngine';
import { projectGameStateForPlayer } from '../src/game/engine/stateProjector';
import { decideBotChallenge, decideBotMove } from '../src/game/bots/localBotEngine';
import { TUTORIAL_STEPS } from '../src/game/tutorial/tutorialEngine';
import { sanitizeChatText } from '../src/services/multiplayer/mockRoomClient';
import { CardInstance, PlayerState } from '../src/types/game';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`فشل الاختبار: ${message}`);
  }
}

function makePlayers(hands: CardInstance[][]): PlayerState[] {
  return hands.map((hand, idx) => ({
    id: idx === 0 ? 'p1' : `p${idx + 1}`,
    name: idx === 0 ? 'سلطان' : `خصم ${idx}`,
    isBot: idx !== 0,
    botDifficulty: 'medium',
    avatarAsset: './assets/sanad.png',
    hand: [...hand],
    hasSanadShield: false,
    isConnected: true,
  }));
}

export function runAllEngineTests(): { passed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;

  const test = (name: string, fn: () => void) => {
    fn();
    passed++;
    results.push(`✅ ${name}`);
  };

  // 1. توزيع البطاقات وكومة السحب المتوازنة
  test('توزيع 4 بطاقات لكل لاعب وتوازن كومة السحب (3 إلى 8 لاعبين)', () => {
    const match4 = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 3,
      botDifficulty: 'medium',
    });
    assert(match4.players.length === 4, 'يجب أن يكون عدد اللاعبين 4');
    for (const p of match4.players) {
      assert(p.hand.length === 4, 'يجب أن يبدأ كل لاعب بـ 4 بطاقات');
    }
    assert(match4.drawPile.length === 48 - 16, 'يجب أن يتبقى 32 بطاقة في الكومة لـ 4 لاعبين');

    const match8 = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 7,
      botDifficulty: 'hard',
    });
    assert(match8.players.length === 8, 'يجب أن يدعم 8 لاعبين');
    assert(match8.drawPile.length === 48 - 32, 'يجب أن يتبقى 16 بطاقة في الكومة لـ 8 لاعبين');
  });

  // 2. حالة عدم التحدي: سرية البطاقة وتنفيذ القدرة حتى لو كان اللاعب كاذبًا
  test('عدم وجود تحدٍّ: بقاء البطاقة المقلوبة سرية وتنفيذ القدرة سواء كان صادقًا أم كاذبًا', () => {
    const players = makePlayers([
      [
        { id: 'c1', characterId: 'malqoof' },
        { id: 'c2', characterId: 'sanad' },
      ],
      [{ id: 'c3', characterId: 'nashal' }],
      [{ id: 'c4', characterId: 'alkabeer' }],
    ]);
    let state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: players,
    });

    // اللاعب الأول يلعب الملقوف لكنه يدّعي كذبًا أنه يلعب «الكبير» ضد p2
    const moved = submitPlayerMove(state, {
      playerId: 'p1',
      cardId: 'c1',
      claimedCharacter: 'alkabeer',
      targetPlayerId: 'p2',
    });
    assert(!moved.errorAr, 'يجب قبول الحركة القانونية');
    state = moved.nextState;

    // التحقق من عدم انكشاف البطاقة في إسقاط الخصوم أثناء نافذة التحدي
    const projectedForP2 = projectGameStateForPlayer(state, 'p2');
    assert(
      !('playedCard' in (projectedForP2.pendingClaimPublic as object)),
      'يجب ألا تنكشف البطاقة المقلوبة للخصوم'
    );

    // انتهاء عداد التحدي دون تحدٍّ (challengerId = null)
    state = resolveChallengeWindow(state, null);
    assert(state.lastOutcome?.revealedCard === null, 'يجب أن تظل البطاقة الحقيقية سرية عند عدم التحدي');
    assert(state.lastOutcome?.abilityExecuted === true, 'يجب تنفيذ القدرة المعلنة عند عدم التحدي حتى لو كذب');
    assert(state.players[1].hand.length === 2, 'يجب أن يسحب الهدف p2 بطاقة بسبب قدرة الكبير');
  });

  // 3. حالة الكذب مع التحدي: إلغاء القدرة وسحب الكاذب بطاقة عقوبة واحدة فقط
  test('تحدي لاعب كاذب: كشف البطاقة، إلغاء القدرة، وسحب الكاذب بطاقة عقوبة واحدة فقط', () => {
    const players = makePlayers([
      [
        { id: 'c1', characterId: 'sanad' },
        { id: 'c2', characterId: 'malqoof' },
      ],
      [{ id: 'c3', characterId: 'nashal' }],
      [{ id: 'c4', characterId: 'alkabeer' }],
    ]);
    let state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: players,
    });

    // p1 يلعب sanad ويدّعي كذبًا alkabeer ضد p2
    state = submitPlayerMove(state, {
      playerId: 'p1',
      cardId: 'c1',
      claimedCharacter: 'alkabeer',
      targetPlayerId: 'p2',
    }).nextState;

    // p2 يضغط «صادوه!»
    state = resolveChallengeWindow(state, 'p2');
    assert(state.lastOutcome?.challenged === true, 'يجب تسجيل التحدي');
    assert(state.lastOutcome?.wasTruthful === false, 'يجب تسجيل أن اللاعب كان كاذبًا');
    assert(state.lastOutcome?.revealedCard?.id === 'c1', 'يجب كشف البطاقة الحقيقية عند التحدي');
    assert(state.lastOutcome?.abilityExecuted === false, 'يجب إلغاء القدرة عند ثبوت الكذب');
    // p1 كان لديه بطاقتان، لعب واحدة (بقيت 1)، ثم سحب عقوبة واحدة فقط -> 2
    assert(state.players[0].hand.length === 2, 'يجب أن يسحب اللاعب الكاذب بطاقة عقوبة واحدة فقط');
    assert(state.players[1].hand.length === 1, 'يجب ألا تتغير بطاقات المتحدي الفائز بالتحدي');
  });

  // 4. حالة الصدق مع التحدي: تنفيذ القدرة وسحب المتحدي بطاقة عقوبة واحدة فقط
  test('تحدي لاعب صادق: كشف البطاقة، تنفيذ القدرة، وسحب المتحدي بطاقة عقوبة واحدة فقط', () => {
    const players = makePlayers([
      [
        { id: 'c1', characterId: 'sanad' },
        { id: 'c2', characterId: 'malqoof' },
      ],
      [{ id: 'c3', characterId: 'nashal' }],
      [{ id: 'c4', characterId: 'alkabeer' }],
    ]);
    let state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: players,
    });

    // p1 يلعب sanad بصدق
    state = submitPlayerMove(state, {
      playerId: 'p1',
      cardId: 'c1',
      claimedCharacter: 'sanad',
    }).nextState;

    // p2 يضغط «صادوه!» بالخطأ
    state = resolveChallengeWindow(state, 'p2');
    assert(state.lastOutcome?.wasTruthful === true, 'اللاعب كان صادقًا');
    assert(state.lastOutcome?.abilityExecuted === true, 'تُنفذ القدرة عند صدق اللاعب');
    assert(state.players[0].hasSanadShield === true, 'تفعّلت حماية السند للاعب الصادق');
    assert(state.players[1].hand.length === 2, 'سحب المتحدي الخاسر بطاقة عقوبة واحدة فقط');
  });

  // 5. اختبار قدرات الشخصيات الست كاملة (الملقوف، النشّال، السند، المصرّف، المخبّص، الكبير)
  test('تنفيذ قدرات الشخصيات الست بصورة صحيحة وحتمية', () => {
    // أ) الملقوف: يكشف بطاقة للاعب الفاعل فقط ولا يكشفها للآخرين
    let state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [
          { id: 'c1', characterId: 'malqoof' },
          { id: 'c2', characterId: 'sanad' },
        ],
        [{ id: 'target_secret', characterId: 'alkabeer' }],
        [{ id: 'c4', characterId: 'nashal' }],
      ]),
    });
    state = submitPlayerMove(state, {
      playerId: 'p1',
      cardId: 'c1',
      claimedCharacter: 'malqoof',
      targetPlayerId: 'p2',
    }).nextState;
    state = resolveChallengeWindow(state, null);

    const viewP1 = projectGameStateForPlayer(state, 'p1');
    const viewP3 = projectGameStateForPlayer(state, 'p3');
    assert(
      viewP1.lastOutcomePublic?.myPrivateReveal?.revealedCard.id === 'target_secret',
      'يجب أن يرى مستخدم الملقوف البطاقة المكتشفة'
    );
    assert(
      viewP3.lastOutcomePublic?.myPrivateReveal === null,
      'يجب ألا يرى اللاعبون الآخرون البطاقة التي كشفها الملقوف'
    );

    // ب) المخبّص: يبدل بطاقة من يد الفاعل ببطاقة عشوائية من يد الهدف
    let swapState = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [
          { id: 'play_mokh', characterId: 'mokhabbes' },
          { id: 'my_give', characterId: 'sanad' },
        ],
        [{ id: 'opp_take', characterId: 'alkabeer' }],
        [{ id: 'c4', characterId: 'nashal' }],
      ]),
    });
    swapState = submitPlayerMove(swapState, {
      playerId: 'p1',
      cardId: 'play_mokh',
      claimedCharacter: 'mokhabbes',
      targetPlayerId: 'p2',
      secondaryCardId: 'my_give',
    }).nextState;
    swapState = resolveChallengeWindow(swapState, null);
    assert(
      swapState.players[0].hand[0].id === 'opp_take' &&
        swapState.players[1].hand[0].id === 'my_give',
      'يجب أن يبدّل المخبّص البطاقتين بين اليدين بنجاح'
    );

    // ج) السند: يحمي صاحبه تلقائيًا من أول قدرة تستهدفه ثم يُستهلك الدرع
    let shieldState = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [
          { id: 'c1', characterId: 'alkabeer' },
          { id: 'c2', characterId: 'sanad' },
        ],
        [{ id: 'c3', characterId: 'nashal' }],
        [{ id: 'c4', characterId: 'malqoof' }],
      ]),
    });
    shieldState.players[1].hasSanadShield = true; // p2 محمي بالسند
    shieldState = submitPlayerMove(shieldState, {
      playerId: 'p1',
      cardId: 'c1',
      claimedCharacter: 'alkabeer',
      targetPlayerId: 'p2',
    }).nextState;
    shieldState = resolveChallengeWindow(shieldState, null);
    assert(shieldState.lastOutcome?.blockedBySanad === true, 'يجب أن يصد السند القدرة تلقائيًا');
    assert(shieldState.players[1].hasSanadShield === false, 'يجب استهلاك درع السند بعد صد أول قدرة');
    assert(shieldState.players[1].hand.length === 1, 'يجب ألا يسحب p2 بطاقة لأن السند حماه');
  });

  // 6. الحالات الخاصة للمصرّف والفوز القانوني
  test('منع الفوز باستخدام البطاقة الإضافية للمصرّف، والسماح بالفوز بالبطاقة الأساسية الأخيرة', () => {
    // الحالة أ: اللاعب يمتلك بطاقتين، يلعب واحدة ويدّعي المصرّف -> لا يجوز أن يفوز بالبطاقة الإضافية للمصرّف!
    let state2Cards = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [
          { id: 'm1', characterId: 'mosarref' },
          { id: 'm2', characterId: 'sanad' },
        ],
        [{ id: 'c3', characterId: 'nashal' }],
        [{ id: 'c4', characterId: 'alkabeer' }],
      ]),
    });
    state2Cards = submitPlayerMove(state2Cards, {
      playerId: 'p1',
      cardId: 'm1',
      claimedCharacter: 'mosarref',
      secondaryCardId: 'm2',
    }).nextState;
    state2Cards = resolveChallengeWindow(state2Cards, null);
    assert(
      state2Cards.winnerPlayerId === null && state2Cards.phase !== 'GAME_OVER',
      'لا يجوز للمصرّف إنهاء المباراة بالبطاقة الإضافية وحدها'
    );
    assert(
      state2Cards.players[0].hand.length === 1,
      'تبقى البطاقة الأخيرة لتُلعب كحركة أساسية في الدور القادم'
    );

    // الحالة ب: اللاعب يمتلك 3 بطاقات، يلعب المصرّف -> يتخلص من البطاقة الأساسية + بطاقة إضافية وتبقى لديه بطاقة واحدة
    let state3Cards = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [
          { id: 'm1', characterId: 'mosarref' },
          { id: 'm2', characterId: 'sanad' },
          { id: 'm3', characterId: 'alkabeer' },
        ],
        [{ id: 'c3', characterId: 'nashal' }],
        [{ id: 'c4', characterId: 'alkabeer' }],
      ]),
    });
    state3Cards = submitPlayerMove(state3Cards, {
      playerId: 'p1',
      cardId: 'm1',
      claimedCharacter: 'mosarref',
      secondaryCardId: 'm2',
    }).nextState;
    state3Cards = resolveChallengeWindow(state3Cards, null);
    assert(state3Cards.players[0].hand.length === 1, 'تخلص المصرّف من بطاقة إضافية وبقيت بطاقة واحدة');

    // الحالة ج: اللاعب يمتلك بطاقة واحدة فقط ولعبها كبطاقة أساسية مع ادعاء المصرّف -> تنتهي قدرة المصرّف دون تأثير ويفوز بالبطاقة الأساسية!
    let state1Card = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [{ id: 'last_card', characterId: 'mosarref' }],
        [{ id: 'c3', characterId: 'nashal' }],
        [{ id: 'c4', characterId: 'alkabeer' }],
      ]),
    });
    state1Card = submitPlayerMove(state1Card, {
      playerId: 'p1',
      cardId: 'last_card',
      claimedCharacter: 'mosarref',
    }).nextState;
    state1Card = resolveChallengeWindow(state1Card, null);
    assert(
      state1Card.winnerPlayerId === 'p1' && state1Card.phase === 'GAME_OVER',
      'يفوز اللاعب عندما تكون البطاقة الأخيرة هي البطاقة الأساسية التي لعبها في دوره'
    );
  });

  // 7. الحالات الخاصة: لعب آخر بطاقة مع الصدق في التحدي مقابل الكذب في التحدي
  test('لعب آخر بطاقة: يفوز إذا كان صادقًا في التحدي، ولا يفوز ويسحب عقوبة إذا كان كاذبًا', () => {
    // كاذب في آخر بطاقة
    let liarLast = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [{ id: 'last_lie', characterId: 'malqoof' }],
        [{ id: 'c2', characterId: 'sanad' }],
        [{ id: 'c3', characterId: 'alkabeer' }],
      ]),
    });
    liarLast = submitPlayerMove(liarLast, {
      playerId: 'p1',
      cardId: 'last_lie',
      claimedCharacter: 'sanad',
    }).nextState;
    liarLast = resolveChallengeWindow(liarLast, 'p2');
    assert(liarLast.winnerPlayerId === null, 'لا يفوز اللاعب إذا كذب في بطاقته الأخيرة وتم صيده');
    assert(liarLast.players[0].hand.length === 1, 'يسحب بطاقة عقوبة وتستمر المباراة');

    // صادق في آخر بطاقة
    let truthLast = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [{ id: 'last_truth', characterId: 'sanad' }],
        [{ id: 'c2', characterId: 'malqoof' }],
        [{ id: 'c3', characterId: 'alkabeer' }],
      ]),
    });
    truthLast = submitPlayerMove(truthLast, {
      playerId: 'p1',
      cardId: 'last_truth',
      claimedCharacter: 'sanad',
    }).nextState;
    truthLast = resolveChallengeWindow(truthLast, 'p2');
    assert(
      truthLast.winnerPlayerId === 'p1' && truthLast.phase === 'GAME_OVER',
      'يفوز اللاعب إذا لعب بطاقته الأخيرة وكان صادقًا عند التحدي'
    );
  });

  // 8. الحالات الخاصة: استخدام النشّال على لاعب لديه بطاقة واحدة (إفراغ يد خصم خارج دوره)
  test('استخدام النشّال على لاعب لديه بطاقة واحدة لا يؤدي إلى فوز الخصم خارج دوره ولا يوقف اللعبة', () => {
    let state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [
          { id: 'n1', characterId: 'nashal' },
          { id: 'n2', characterId: 'sanad' },
        ],
        [{ id: 'p2_only_card', characterId: 'alkabeer' }],
        [{ id: 'c3', characterId: 'malqoof' }],
      ]),
    });
    state = submitPlayerMove(state, {
      playerId: 'p1',
      cardId: 'n1',
      claimedCharacter: 'nashal',
      targetPlayerId: 'p2',
    }).nextState;
    state = resolveChallengeWindow(state, null);

    assert(state.players[1].hand.length === 0, 'أصبحت يد p2 فارغة بعد سحب بطاقته بالنشّال');
    assert(
      state.winnerPlayerId === null && state.phase !== 'GAME_OVER',
      'إفراغ يد خصم بقدرة النشّال لا يمنحه الفوز خارج دوره'
    );

    // عند انتقال الدور إلى p2، يسحب بطاقة تلقائيًا ليتمكن من اللعب ولا تتوقف المباراة
    state = advanceToNextTurn(state);
    assert(state.currentPlayerIndex === 1, 'انتقل الدور إلى p2');
    assert(
      state.players[1].hand.length === 1,
      'سحب p2 بطاقة تلقائيًا عند بدء دوره لأن يده أُفرغت سابقًا بقدرة خصم'
    );
  });

  // 9. الحالات الخاصة: انتهاء كومة السحب وإعادة خلط البطاقات المستخدمة أو فراغ الكومتين معًا
  test('إعادة خلط البطاقات المستخدمة عند فراغ كومة السحب، وعدم تعطل اللعبة عند فراغ الكومتين', () => {
    let state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
      customPlayers: makePlayers([
        [
          { id: 'a1', characterId: 'alkabeer' },
          { id: 'a2', characterId: 'sanad' },
        ],
        [{ id: 'b1', characterId: 'malqoof' }],
        [{ id: 'c1', characterId: 'nashal' }],
      ]),
      customDrawPile: [], // كومة سحب فارغة!
    });
    state.discardPile = [{ id: 'disc_1', characterId: 'mosarref' }];

    state = submitPlayerMove(state, {
      playerId: 'p1',
      cardId: 'a1',
      claimedCharacter: 'alkabeer',
      targetPlayerId: 'p2',
    }).nextState;
    state = resolveChallengeWindow(state, null);

    assert(
      state.players[1].hand.length === 2,
      'أُعيد خلط البطاقات المستخدمة وسحب الهدف بطاقة بنجاح'
    );
  });

  // 10. الحالات الخاصة: منع استهداف النفس وانتهاء عداد الـ15 ثانية
  test('منع استهداف اللاعب لنفسه وتنفيذ حركة قانونية تلقائية عند انتهاء عداد الـ15 ثانية', () => {
    let state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 2,
      botDifficulty: 'medium',
    });

    const selfTargetAttempt = submitPlayerMove(state, {
      playerId: 'player_human',
      cardId: state.players[0].hand[0].id,
      claimedCharacter: 'alkabeer',
      targetPlayerId: 'player_human',
    });
    assert(
      Boolean(selfTargetAttempt.errorAr),
      'يجب رفض محاولة استهداف اللاعب لنفسه بقدرة مخصصة للخصوم'
    );

    const afterTimeout = executeAutoTimeoutMove(state);
    assert(
      afterTimeout.phase === 'CHALLENGE_WINDOW' && afterTimeout.pendingClaim !== null,
      'يجب أن ينفذ المحرك حركة قانونية تلقائية عند انتهاء وقت الاختيار'
    );
  });

  // 11. اختبار الخصوم الآليين وعدم اطلاعهم على معلومات مخفية + الجولة التعليمية + الشات
  test('قرارات الخصوم الآليين (سهل/متوسط/صعب) والجولة التعليمية وتنقية الشات', () => {
    const state = createMatch({
      humanPlayerName: 'سلطان',
      botCount: 3,
      botDifficulty: 'hard',
    });
    // نقل الدور للبوت الأول
    const botTurnState = { ...state, currentPlayerIndex: 1 };
    const botProjected = projectGameStateForPlayer(botTurnState, 'player_bot_1');
    const botMove = decideBotMove(
      botProjected,
      botTurnState.botMemories['player_bot_1'],
      'hard'
    );
    assert(
      botProjected.myHand.some((c) => c.id === botMove.cardId),
      'يجب أن يختار البوت بطاقة حقيقية من يده فقط'
    );

    const afterBotMove = submitPlayerMove(botTurnState, botMove).nextState;
    const otherBotProjected = projectGameStateForPlayer(afterBotMove, 'player_bot_2');
    const challengeDecision = decideBotChallenge(
      otherBotProjected,
      afterBotMove.botMemories['player_bot_2'],
      'medium'
    );
    assert(typeof challengeDecision === 'boolean', 'يجب أن يعيد قرار التحدي قيمة منطقية قانونية');

    assert(
      Object.keys(TUTORIAL_STEPS).length === 6,
      'يجب أن تتكون الجولة التعليمية من 6 خطوات محددة مسبقًا'
    );
    assert(
      sanitizeChatText('https://malicious.example.com').ok === false,
      'يجب أن يمنع الشات إرسال الروابط'
    );
    assert(
      sanitizeChatText('يا ساتر، شكلك بتصير محترف!').ok === true,
      'يجب أن يقبل الشات العبارات النصية العادية'
    );
  });

  return { passed, results };
}
