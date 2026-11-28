/**
 * Hầm Bổ đề — chữ hiển thị (en / vi). Server chỉ gửi KHOÁ (câu nói nhanh, câu thoại Tiếng Vọng, bậc gợi ý) → không thể
 * mang dữ liệu cá nhân (COOP_PUZZLE.md §4.2). File này chỉ dùng ở client (không chép sang realtime).
 */
type L = { en: string; vi: string };
const T = (en: string, vi: string): L => ({ en, vi });

export const VAULT_NAME = T("The Lemma Vaults", "Hầm Bổ đề");
export const VAULT_SUB = T("A proof needs more than one mind.", "Một chứng minh cần nhiều hơn một bộ óc.");
export const VAULT_LORE = T(
  "Before the Shattering, every Theorem rested on lemmas kept in vaults beneath the Plaza. A lemma was proven only when more than one mind checked it. The vaults open only to many hands.",
  "Trước Đại Vỡ, mọi Định lý tựa trên những bổ đề cất dưới Quảng trường. Một bổ đề chỉ được chứng minh khi có nhiều hơn một bộ óc kiểm tra. Các hầm chỉ mở cho nhiều bàn tay.",
);

export const ECHO_NAMES: Record<string, L> = {
  euler: T("Echo of Euler", "Tiếng Vọng Euler"),
  noether: T("Echo of Noether", "Tiếng Vọng Noether"),
  turing: T("Echo of Turing", "Tiếng Vọng Turing"),
  ada: T("Echo of Ada", "Tiếng Vọng Ada"),
};

export const CHAMBERS: Record<string, { name: L; stages: { name: L; goal: L }[] }> = {
  threshold: {
    name: T("The Threshold", "Sảnh Ngưỡng cửa"),
    stages: [{ name: T("Many hands", "Nhiều bàn tay"), goal: T("Learn the three signals of the vault.", "Học ba tín hiệu của hầm.") }],
  },
  konigsberg: {
    name: T("I. The Bridges of Königsberg", "I. Cầu Königsberg"),
    stages: [
      { name: T("Your own little town", "Thị trấn nhỏ của bạn"), goal: T("Glide down, then light every bridge — each one exactly once.", "Lượn xuống một đảo, rồi thắp sáng mọi cây cầu — mỗi cầu đúng một lần.") },
      { name: T("Königsberg, 1736", "Königsberg, năm 1736"), goal: T("Euler said one walker can't do it. Can your team?", "Euler nói một người không làm nổi. Cả đội thì sao?") },
      { name: T("The Grand Graph", "Đại đồ thị"), goal: T("Every thread is needed. Plan from the Overlook first.", "Cần đủ mọi sợi chỉ. Lên kế hoạch trên Đài quan sát trước.") },
    ],
  },
  balance: {
    name: T("II. Archimedes' Balance", "II. Cân Archimedes"),
    stages: [
      { name: T("Level the scale", "Cân lại đòn cân"), goal: T("Stand on the notches until the beam is level for 2 seconds.", "Đứng lên các khắc tới khi đòn cân thăng bằng 2 giây.") },
      { name: T("Cross together", "Cùng sang bờ"), goal: T("Everyone on the far notches (5+), beam still level. The stone slides when pushed (F).", "Cả đội đứng ở các khắc xa bên phải (từ 5), đòn vẫn thăng bằng. Đứng cạnh Tảng đá bấm F để đẩy.") },
      {
        name: T("The catapult", "Máy bắn đá"),
        goal: T(
          "Ride the updraft, plunge onto the short end, launch whoever sits on the long end. Ring bell A (4.5 m), then bell B (9 m).",
          "Bay theo cột gió, bổ nhào xuống đầu ngắn để bắn người ngồi ở đầu dài. Làm kêu chuông A (4,5 m), rồi chuông B (9 m).",
        ),
      },
    ],
  },
  fourier: {
    name: T("V. The Fourier Choir", "V. Dàn hợp xướng Fourier"),
    stages: [
      { name: T("Tune", "Lên dây"), goal: T("Stand on a pipe and turn its dial. Match the gold wave together.", "Đứng lên bệ ống và vặn núm. Cùng nhau khớp sóng vàng.") },
      { name: T("The odd ones", "Những ống lẻ"), goal: T("Only odd pipes this time. Sing the square wave.", "Lần này chỉ có ống lẻ. Hãy hát sóng vuông.") },
      { name: T("The Conductor", "Nhạc trưởng"), goal: T("Only the Conductor's podium shows the spectrum. Pipers see only waves.", "Chỉ bục Nhạc trưởng thấy phổ. Người thổi ống chỉ thấy sóng.") },
    ],
  },
  finale: {
    name: T("The Theorem Engine", "Cỗ máy Định lý"),
    stages: [{ name: T("Many hands, one proof", "Nhiều bàn tay, một chứng minh"), goal: T("Everyone stands on a lemma plate. Hold for 3 seconds.", "Mỗi người đứng lên một phiến bổ đề. Giữ 3 giây.") }],
  },
};

/** Nhịp của Ngưỡng cửa */
export const BEATS: L[] = [
  T("Everyone: stand on a glowing sigil.", "Mọi người: đứng lên một ấn ký phát sáng."),
  T("Two bells, far apart, must ring within half a second. Stand at the ropes and use “3-2-1!”.", "Hai quả chuông xa nhau phải ngân trong nửa giây. Đứng ở hai dây rồi bấm “3-2-1!”."),
  T("A hidden plate: only the lantern-bearer ● can see it. ● — ping it so someone else stands there.", "Phiến đá ẩn: chỉ người cầm đèn ● nhìn thấy. ● hãy PING để người khác tới đứng."),
];

/** Gợi ý 3 bậc theo phòng + màn (khoá "phòng.màn") */
export const HINTS: Record<string, L[]> = {
  threshold: [
    T("Each sigil wants one person — Echoes count.", "Mỗi ấn ký cần một người — Tiếng Vọng cũng tính."),
    T("Ping a rope (X / long-press) to send an Echo there, then press “3-2-1!” and ring on GO.", "Ping vào dây chuông (X / nhấn giữ) để gọi Tiếng Vọng tới, rồi bấm “3-2-1!” và kéo đúng lúc GO."),
    T("● sees a glowing plate on the floor. Ping it.", "● thấy một phiến sáng trên sàn. Hãy ping vào nó."),
  ],
  konigsberg: [
    T("Count the bridges touching each island.", "Đếm số cây cầu chạm vào mỗi đảo."),
    T("A thread passing THROUGH an island uses two bridges there. So where must threads begin or end?", "Sợi chỉ đi XUYÊN qua một đảo dùng hai cây cầu ở đó. Vậy sợi chỉ phải bắt đầu hoặc kết thúc ở đâu?"),
    T("Odd islands now glow. Each walker starts on an odd island.", "Các đảo lẻ đang phát sáng. Mỗi người bắt đầu ở một đảo lẻ."),
  ],
  "balance.2": [
    T(
      "Was the launch higher or lower than your fall? A seesaw can't make energy — it only passes on what you bring down.",
      "Cú bắn cao hơn hay thấp hơn chỗ bạn rơi? Bập bênh không tự sinh năng lượng — nó chỉ chuyển tiếp thứ bạn mang xuống.",
    ),
    T(
      "Two at once: two bodies landing together (within ¼ s) carry twice the momentum. Press “3-2-1!” and plunge on GO.",
      "Hai người cùng lúc: hai người chạm bệ cùng nhau (trong ¼ giây) mang gấp đôi động lượng. Bấm “3-2-1!” rồi bổ nhào đúng lúc GO.",
    ),
    T(
      "The far socket now glows: a longer throwing arm trades force for speed. Two plungers fly highest at d₂/d₁ ≈ 1.4.",
      "Ổ xa đang sáng: cánh tay ném dài hơn đổi lực lấy tốc độ. Hai người rơi thì bay cao nhất khi d₂/d₁ ≈ 1,4.",
    ),
  ],
  balance: [
    T("Which notch tips the beam the most?", "Khắc nào làm đòn nghiêng nhiều nhất?"),
    T("Each notch number is how hard that spot pushes. The stone pushes mass × notch.", "Số trên khắc là độ mạnh chỗ đó đẩy. Tảng đá đẩy bằng khối lượng × khắc."),
    T("Turning effect is now shown live: make the two sides equal.", "Mô-men đang hiện trực tiếp: làm hai bên bằng nhau."),
  ],
  fourier: [
    T("Listen — does it get closer when this pipe is quieter?", "Lắng nghe — có gần hơn khi ống này nhỏ đi không?"),
    T("Each pipe adds one sine wave. A pipe whose number is k usually wants about 1/k.", "Mỗi ống cộng một sóng sin. Ống số k thường cần khoảng 1/k."),
    T("Target bars are now shown to everyone.", "Cột phổ đích giờ hiện cho mọi người."),
  ],
  finale: [
    T("One person per plate — call your Echo with a ping.", "Mỗi phiến một người — gọi Tiếng Vọng bằng ping."),
    T("Hold still together for three seconds.", "Cùng đứng yên ba giây."),
    T("Every plate glows when taken.", "Phiến nào có người sẽ sáng lên."),
  ],
};

/** Thẻ bổ đề (hiện SAU khi hiểu ra — công thức xuất hiện lần đầu ở đây) */
export const LEMMAS: Record<string, { title: L; why: L; formula: string }> = {
  konigsberg: {
    title: T("Lemma I · Euler's count", "Bổ đề I · Phép đếm của Euler"),
    why: T(
      "A walk passing through an island uses its bridges in pairs, so only a thread's two ends can sit on odd islands. 2k odd islands need exactly k threads — that is why the team was the right size.",
      "Mỗi lần đi xuyên qua một đảo dùng cầu theo từng cặp, nên chỉ hai đầu sợi chỉ mới nằm ở đảo lẻ. 2k đảo lẻ cần đúng k sợi chỉ — vì thế đội của bạn vừa đủ người.",
    ),
    formula: "#threads = max(1, #odd / 2)",
  },
  balance: {
    title: T("Lemma II · The law of the lever", "Bổ đề II · Định luật đòn bẩy"),
    why: T(
      "Turning effect is mass × distance. A small weight far out balances a big one close in: the beam is level when the turning effects cancel — the centre of mass sits over the pivot. In the catapult, angular momentum m·v·d is conserved (Noether: turning symmetry ⇒ a conserved quantity), so a lever never makes energy: two bodies falling together carry more, and the arm ratio only trades force for speed.",
      "Mô-men = khối lượng × khoảng cách. Vật nhẹ ở xa cân được vật nặng ở gần: đòn thăng bằng khi các mô-men triệt tiêu — trọng tâm nằm ngay trên điểm tựa. Ở máy bắn đá, mô-men động lượng m·v·d được bảo toàn (Noether: đối xứng quay ⇒ một đại lượng bảo toàn), nên đòn bẩy không tự sinh năng lượng: hai người cùng rơi mang được nhiều hơn, còn tỉ lệ cánh tay chỉ đổi lực lấy tốc độ.",
    ),
    formula: "Σ mᵢ·dᵢ = 0   ·   m₁v₁d₁ = (m₁d₁² + m₂d₂²)·ω",
  },
  fourier: {
    title: T("Lemma III · Every wave is a choir of sines", "Bổ đề III · Mọi sóng là một dàn sin"),
    why: T(
      "Any periodic wave is a sum of sines. The square wave uses only odd pipes (1, 1/3, 1/5 …) and its corners always overshoot by about 9 % (Gibbs). The bars and the wave are two views of the same thing.",
      "Mọi sóng tuần hoàn là tổng các sóng sin. Sóng vuông chỉ dùng ống lẻ (1, 1/3, 1/5 …) và các góc luôn vọt lố khoảng 9 % (Gibbs). Cột phổ và hình sóng là hai cách nhìn của cùng một vật.",
    ),
    formula: "f(x) = Σ aₖ · sin(k x)",
  },
};

/** Câu nói nhanh (id → chữ) */
export const SAYS: Record<string, L> = {
  ready: T("Ready!", "Sẵn sàng!"),
  on3: T("On 3!", "Đếm 3-2-1!"),
  wait: T("Wait for me", "Chờ mình với"),
  mine: T("I'll do it", "Để mình làm"),
  yourturn: T("Your turn", "Tới lượt bạn"),
  undo: T("Undo / rewind", "Làm lại nhé"),
  other: T("Try the other order", "Thử thứ tự khác"),
  count: T("Count them!", "Đếm thử xem!"),
  moreless: T("More / less", "Thêm / bớt chút"),
  balanced: T("I think it's balanced", "Hình như cân rồi"),
  nice: T("Nice!", "Hay quá!"),
  thanks: T("Thanks!", "Cảm ơn!"),
  "k.odd": T("Start on an odd island!", "Bắt đầu ở đảo lẻ!"),
  "k.spent": T("That bridge is spent", "Cầu đó đi rồi"),
  "b.out": T("Move out", "Ra xa hơn"),
  "b.in": T("Move in", "Vào gần hơn"),
  "f.loud": T("Too loud", "To quá"),
  "f.flip": T("Flip it", "Đảo dấu đi"),
};
export const SAY_PAGES: string[][] = [
  ["ready", "on3", "wait", "mine", "yourturn", "undo"],
  ["other", "count", "moreless", "balanced", "nice", "thanks"],
];
export const SAY_CONTEXT: Record<string, string[]> = { konigsberg: ["k.odd", "k.spent"], balance: ["b.out", "b.in"], fourier: ["f.loud", "f.flip"] };

/** Câu thoại Tiếng Vọng (phản hồi, không bao giờ là lời giải) */
export const ECHO_LINES: Record<string, L> = {
  "e.island": T("Point me to an island to land on.", "Chỉ cho mình một hòn đảo để đáp xuống nhé."),
  "e.glide": T("Gliding down…", "Mình lượn xuống đây…"),
  "e.where": T("Where shall I go? Ping a bridge.", "Mình đi đâu đây? Ping vào một cây cầu nhé."),
  "e.nobridge": T("No unspent bridge from here to there.", "Không có cầu chưa đi nào từ đây tới đó."),
  "e.notend": T("That bridge doesn't touch my island.", "Cầu đó không chạm đảo mình đang đứng."),
  "e.spent": T("That bridge is already spent.", "Cầu đó đã đi rồi."),
  "e.cross": T("Crossing!", "Mình qua cầu đây!"),
  "e.push": T("Heave!", "Dô ta!"),
  "e.tostone": T("I'll stand by the stone. Ping it again to push.", "Mình ra đứng cạnh tảng đá. Ping lần nữa để đẩy."),
  "e.notch": T("Standing on that notch.", "Mình đứng ở khắc đó."),
  "e.tower": T("I'll ride the updraft and wait at the top. Press “3-2-1!” — I plunge on GO.", "Mình bay theo cột gió lên đỉnh chờ. Bấm “3-2-1!” — tới GO mình bổ nhào."),
  "e.seat": T("I'm on the throwing end. Launch me!", "Mình ngồi đầu ném rồi. Bắn mình đi!"),
  "e.tolever": T("I'll take the fulcrum lever. Ping it again to move the fulcrum.", "Mình ra cần gạt điểm tựa. Ping lần nữa để dời điểm tựa."),
  "e.socket": T("Fulcrum moved to the next socket.", "Đã dời điểm tựa sang ổ kế."),
  "e.ok": T("On my way.", "Mình tới đây."),
  "e.topipe": T("I'll take that pipe. Tell me + or −.", "Mình giữ ống này. Bảo mình + hay − nhé."),
  "e.turn": T("Turning… like this?", "Vặn… thế này à?"),
  "e.podium": T("I'm on the podium.", "Mình lên bục rồi."),
  "e.rope": T("I'm at the rope. Press “3-2-1!” — I'll pull on GO.", "Mình ở dây chuông rồi. Bấm “3-2-1!” — mình kéo đúng lúc GO."),
};

export const UI = {
  solo: T("Play solo (with Echoes)", "Chơi một mình (cùng Tiếng Vọng)"),
  create: T("Create a party", "Lập tổ đội"),
  join: T("Join", "Vào"),
  code: T("Party code", "Mã tổ đội"),
  enterCode: T("4-letter code", "Mã 4 ký tự"),
  players: T("2–4 players · pings & quick-chat only", "2–4 người · chỉ ping và nói nhanh"),
  enter: T("Enter the Lemma Vaults", "Vào Hầm Bổ đề"),
  leave: T("Leave the vault", "Rời Hầm"),
  ready: T("Ready", "Sẵn sàng"),
  notReady: T("Not ready", "Chưa sẵn sàng"),
  start: T("Start", "Bắt đầu"),
  addEcho: T("Add an Echo", "Thêm Tiếng Vọng"),
  removeEcho: T("Remove an Echo", "Bớt Tiếng Vọng"),
  lobby: T("Waiting room", "Phòng chờ"),
  lobbyTip: T("Share the code with friends. Empty seats are filled by Echoes, who follow your pings.", "Gửi mã cho bạn bè. Ghế trống do Tiếng Vọng ngồi — họ làm theo ping của bạn."),
  ping: T("Ping", "Ping"),
  pingTip: T("X / middle-click / long-press: point at something", "X / chuột giữa / nhấn giữ: chỉ vào một chỗ"),
  chat: T("Quick-chat", "Nói nhanh"),
  count: T("3-2-1!", "3-2-1!"),
  hint: T("Ask the Echo", "Hỏi Tiếng Vọng"),
  hintAsk: T("asks for a hint", "muốn nghe gợi ý"),
  notYet: T("Not yet", "Chưa cần"),
  hintOffer: T("The Echo has a question for you", "Tiếng Vọng có một câu hỏi"),
  go: T("GO!", "GO!"),
  echo: T("Echo", "Tiếng Vọng"),
  offline: T("away — Echo holds the seat", "vắng — Tiếng Vọng giữ ghế"),
  you: T("you", "bạn"),
  target: T("Pings go to", "Ping gửi tới"),
  nearest: T("nearest Echo", "Tiếng Vọng gần nhất"),
  rewind: T("Rewind thread", "Tua lại sợi chỉ"),
  thread: T("Your thread", "Sợi chỉ của bạn"),
  noThread: T("Glide down to an island to start your thread", "Lượn xuống một đảo để bắt đầu sợi chỉ"),
  bridges: T("bridges", "cầu"),
  knot: T("Knot! No unspent bridge here — rewind (F)", "Thắt nút! Hết cầu chưa đi — tua lại (F)"),
  push: T("Push the stone", "Đẩy tảng đá"),
  ring: T("Ring the bell", "Kéo chuông"),
  level: T("LEVEL", "THĂNG BẰNG"),
  torque: T("turning effect", "mô-men"),
  error: T("error", "sai số"),
  pipe: T("Pipe", "Ống"),
  conductor: T("Conductor's podium", "Bục Nhạc trưởng"),
  spectrum: T("Target spectrum (only you can see this)", "Phổ đích (chỉ bạn thấy)"),
  tellPiper: T("Tell the piper", "Báo cho người giữ ống"),
  clear: T("Stage clear!", "Qua màn!"),
  continue: T("Continue", "Tiếp tục"),
  waiting: T("waiting for", "đang chờ"),
  done: T("The Theorem is restored!", "Định lý đã phục hồi!"),
  moments: T("Moments", "Khoảnh khắc"),
  unaided: T("Unaided ✦", "Không cần gợi ý ✦"),
  again: T("Play again", "Chơi lại"),
  back: T("Back to the Plaza", "Về Quảng trường"),
  netDown: T("No connection to the game server — party play needs it. Play solo instead?", "Không kết nối được máy chủ game — tổ đội cần kết nối. Chơi một mình nhé?"),
  errNocode: T("No party with that code.", "Không có tổ đội nào mang mã này."),
  errFull: T("That party is full or already started.", "Tổ đội đã đủ người hoặc đã bắt đầu."),
  copy: T("Copy", "Chép"),
  copied: T("Copied", "Đã chép"),
  mute: T("Choir sound", "Âm thanh dàn ống"),
  stage: T("Stage", "Màn"),
  reset: T("Reset stage", "Làm lại màn"),
  resetVote: T("Reset (majority)", "Làm lại (đa số)"),
  plate: T("Hidden plate — ping it!", "Phiến ẩn — hãy ping!"),
  lantern: T("You carry the lantern ●", "Bạn cầm đèn ●"),
  look: T("Overlook", "Đài quan sát"),
  mute2: T("Mute", "Tắt tiếng"),
  odd: T("odd", "lẻ"),
  plunge: T("Plunge!", "Bổ nhào!"),
  socket: T("Move the fulcrum", "Dời điểm tựa"),
  fulcrum: T("Fulcrum", "Điểm tựa"),
  sockN: T("socket", "ổ"),
  bell: T("Bell", "Chuông"),
  sealed: T("sealed until A rings", "bị niêm tới khi A kêu"),
  lastShot: T("Last shot", "Cú bắn vừa rồi"),
  fell: T("fell", "rơi"),
  flew: T("flew", "bay"),
  need: T("need", "cần"),
  weight: T("the Lemma Weight", "Quả cân Bổ đề"),
  plungers: T("plungers", "người rơi"),
  late: T("landed too late — wasted (land within ¼ s)", "chạm bệ trễ — phí công (phải cùng trong ¼ giây)"),
  launched: T("launched", "được bắn lên"),
  catTip: T("Jump twice on the short end to glide up the updraft, then plunge (F / click).", "Ở đầu ngắn nhảy 2 lần để lượn theo cột gió lên, rồi bổ nhào (F / bấm chuột)."),
  energy: T("A lever can't make energy: flight ≤ fall (one plunger).", "Đòn bẩy không tự sinh năng lượng: bay ≤ rơi (một người rơi)."),
};

export const MOMENTS: Record<string, L> = {
  br: T("lit {n} bridges", "thắp {n} cây cầu"),
  push: T("pushed the Lemma Stone {n} times", "đẩy Tảng Bổ đề {n} lần"),
  dial: T("tuned the pipes {n} times", "lên dây {n} lần"),
  ring: T("rang the bell on GO", "kéo chuông đúng lúc GO"),
  ping: T("pointed the way {n} times", "chỉ đường {n} lần"),
  hold: T("held steady when it counted", "đứng vững đúng lúc quan trọng"),
};

export function tx(l: L, vi: boolean): string {
  return vi ? l.vi : l.en;
}
