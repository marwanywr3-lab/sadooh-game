# دليل التكامل المعماري (INTEGRATION.md) — موجّه لـ ChatGPT

> وثيقة مرجعية أصلية محفوظة من ZIP. الاختيار الحالي هو Supabase حسب توجيه المستخدم؛ راجع [DEPLOYMENT.md](DEPLOYMENT.md) للمعمارية المنفذة. لم يُنشر خادم Cloudflare المذكور أدناه.

يوضح هذا المستند المعمارية البرمجية لمشروع **«صادوه!» (Sadooh!)** وكيفية الانتقال السلس من اللعب المحلي الحالي إلى اللعب الجماعي الحقيقي عبر **Cloudflare Workers + Durable Objects** وربط **Gemini API** بالخصوم الآليين على الخادم.

## 1. خريطة محرك اللعبة وقواعدها (Game Engine & Rules)

صُمّم محرك اللعبة ليكون **حتميًا (Deterministic) وخاليًا تمامًا من أي اعتماد على المتصفح أو DOM**، مما يسمح بنقله أو استيراده مباشرة داخل Cloudflare Durable Object:

- **`src/types/game.ts`**:
  - يحتوي على الحالة الكاملة للمباراة `GameState` (التي يجب أن تبقى داخل الخادم فقط في اللعب الجماعي)، والحالة المسقطة الآمنة `ClientProjectedGameState` التي تُرسل إلى كل لاعب على حدة.
- **`src/game/rules/characters.ts`**:
  - تعريف الشخصيات الست (`malqoof`, `nashal`, `sanad`, `mosarref`, `mokhabbes`, `alkabeer`) وهل تتطلب هدفًا (`requiresTarget`).
- **`src/game/rules/deck.ts`**:
  - توليد كومة السحب المتوازنة (`createBalancedDeck`: 48 بطاقة، 8 لكل شخصية) ودالة السحب الآمن (`drawOneCardSafely`) التي تعيد خلط البطاقات المستخدمة تلقائيًا دون كشفها.
- **`src/game/rules/validators.ts`**:
  - التحقق القانوني من الحركات (`validateMoveSubmission`) ومنع استهداف اللاعب لنفسه.
- **`src/game/engine/gameEngine.ts`**:
  - الدوال النقية (Pure State Transitions) التي تدير دورة حياة المباراة بالكامل:
    - `createMatch(options)`: إنشاء المباراة وتوزيع 4 بطاقات لكل لاعب.
    - `submitPlayerMove(state, submission)`: وضع البطاقة مقلوبة وبدء عداد التحدي (5 ثوانٍ).
    - `executeAutoTimeoutMove(state, rng)`: تنفيذ حركة قانونية تلقائية عند انتهاء عداد الـ 15 ثانية.
    - `resolveChallengeWindow(state, challengerId, rng)`: تسوية التحدي (اعتماد أول متحدٍّ صالح فقط)، تطبيق العقوبة (بطاقة واحدة فقط للخاسر)، تنفيذ القدرة أو صدّها بدرع «السند»، والتحقق من شروط الفوز القانوني (مع منع الفوز بالبطاقة الإضافية لـ«المصرّف» ومنع الفوز خارج الدور عند إفراغ اليد بـ«النشّال»).
    - `advanceToNextTurn(state, rng)`: الانتقال للدور التالي وإلغاء درع «السند» المنتهي.
- **`src/game/engine/stateProjector.ts`**:
  - الدالة `projectGameStateForPlayer(state, viewerPlayerId)` هي حجر الزاوية الأمني؛ فهي تحذف بطاقات الخصوم السرية، وتحذف هوية البطاقة المقلوبة على الطاولة (`pendingClaim.playedCard`)، وتحذف محتويات كومة السحب، وتُظهر نتيجة «الملقوف» السرية (`myPrivateReveal`) لصاحب القدرة فقط.

## 2. كيفية ربط Cloudflare Workers وDurable Objects

### المعمارية المقترحة على Cloudflare:

1. **Worker Router (`worker/index.ts`)**:
   - يستقبل طلبات إنشاء الغرف `POST /api/rooms` ويولّد رمز غرفة (مثل `EST-482`).
   - يوجّه اتصالات WebSocket `GET /api/rooms/:roomCode/ws` إلى كائن **Durable Object** مخصص لتلك الغرفة (`SadoohRoomDO`).
2. **Durable Object (`SadoohRoomDO`)**:
   - يحتفظ بـ `RoomState` و `GameState` الكاملة في الذاكرة (ويمكن حفظ لقطات في `ctx.storage` لدعم إعادة الاتصال).
   - يدير المؤقتات الرسمية على الخادم عبر `ctx.storage.setAlarm()` لعداد الـ 15 ثانية (اختيار الحركة) وعداد الـ 5 ثوانٍ (نافذة التحدي).
   - عند كل تغيير في `GameState`، يستدعي `projectGameStateForPlayer(this.gameState, member.id)` لكل اتصال WebSocket مفتوح ويرسل له حدث `STATE_SYNC` المخصص له فقط.

## 3. العقود البرمجية للأحداث (WebSocket Event Contracts)

جميع العقود معرّفة وجاهزة في **`src/types/multiplayer.ts`**:

### من المتصفح إلى الخادم (`ClientToServerEvent`):
- `CREATE_ROOM`: `{ playerName, maxPlayers }`
- `JOIN_ROOM`: `{ roomCode, playerName, reconnectToken? }`
- `ADD_BOT` / `REMOVE_BOT`: إدارة الخصوم الآليين في الغرف المختلطة.
- `START_MATCH`: يبدأ المباراة من قِبل المضيف (`isHost`).
- `SUBMIT_MOVE`: `{ cardId, claimedCharacter, targetPlayerId, secondaryCardId? }`
- `PRESS_SADOOH`: `{ matchId, turnNumber }` (يعتمد الخادم أول رسالة تصل خلال نافذة الـ 5 ثوانٍ فقط).
- `SEND_CHAT`: `{ text, isQuickReaction? }` (يجب تمريرها عبر `sanitizeChatText` على الخادم أيضًا).
- `MUTE_PLAYER` / `REPORT_ABUSE`: كتم اللاعب أو تسجيل بلاغ إساءة في D1.
- `RECONNECT_MATCH`: `{ roomCode, playerId, reconnectToken }`.

### من الخادم إلى المتصفح (`ServerToClientEvent`):
- `ROOM_UPDATED`: يرسل `RoomState` المحدثة لجميع أعضاء الغرفة.
- `MATCH_STARTED` و `STATE_SYNC`: يرسل `ClientProjectedGameState` المفلترة لكل لاعب.
- `CHAT_RECEIVED`: يبث رسالة الشات لجميع أعضاء الغرفة.
- `PLAYER_CONNECTION_CHANGED`: يحدث مؤشر الاتصال/الانقطاع.

## 4. حماية معلومات البطاقات السرية ونقل الصلاحية للخادم

- **المتصفح ليس مصدر الثقة النهائي**:
  - لا يرسل المتصفح نتيجة القدرة أو هوية البطاقة، بل يرسل فقط `cardId` الذي يريد لعبه و `claimedCharacter`.
  - يتحقق الخادم عبر `validateMoveSubmission` أن `cardId` موجود فعلًا في `state.players[currentPlayerIndex].hand` الخاصة بالمرسل.
- **حجب المعلومات السرية**:
  - لا ترسل `GameState` الخام عبر WebSocket أبدًا؛ استخدم دائمًا `projectGameStateForPlayer(state, playerId)` من `src/game/engine/stateProjector.ts`.

## 5. مكان ربط Gemini API مستقبلًا (Server-Side AI Bots)

- يوجد العقد البرمجي الكامل في **`src/services/ai/botDecisionProvider.ts`**:
  - الواجهة `IBotDecisionProvider` تحتوي على الدالتين:
    1. `getMoveDecision(projectedState, legalMemory, difficulty): Promise<MoveSubmission>`
    2. `getChallengeDecision(projectedState, legalMemory, difficulty): Promise<boolean>`
  - عند تشغيل البوت داخل Cloudflare Durable Object:
    - مرّر للبوت **فقط** `projectGameStateForPlayer(state, botId)` و `state.botMemories[botId]` (حتى لا يغش النموذج اللغوي أبدًا!).
    - اطلب من Gemini API إرجاع JSON يطابق `GeminiBotMoveResponse` أو `GeminiBotChallengeResponse`.
    - بعد استلام قرار Gemini API، مرّره إلى `submitPlayerMove` أو `resolveChallengeWindow` في `gameEngine.ts`، بحيث تظل **نتائج الأدوار حتمية ومحددة بمحرك اللعبة** وليس بقرار عشوائي من النموذج اللغوي.
    - في حال تأخر Gemini API أو فشل الشبكة، استخدم `decideBotMove` و `decideBotChallenge` من `src/game/bots/localBotEngine.ts` كبديل فوري (Fallback).

## 6. الملفات التي ينبغي تعديلها للانتقال إلى اللعب الجماعي الحقيقي

1. **`src/services/multiplayer/mockRoomClient.ts`**:
   - استبدل `PreviewMultiplayerRoomService` بـ `CloudflareWebSocketRoomService` الذي يفتح اتصال `new WebSocket(VITE_WS_URL)` ويرسل/يستقبل `ClientToServerEvent` و `ServerToClientEvent`.
2. **`src/screens/MultiplayerLobbyScreen.tsx`**:
   - عند استقبال حدث `MATCH_STARTED` من الخادم، انقل المستخدم إلى شاشة الطاولة مع تمرير `ClientProjectedGameState` القادمة من WebSocket.
3. **إضافة مجلد `worker/` في جذر المشروع**:
   - استورد فيه `src/game/engine/gameEngine.ts` و `src/game/engine/stateProjector.ts` مباشرة داخل Durable Object.
