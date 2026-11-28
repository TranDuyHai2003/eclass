/**
 * SINH TỰ ĐỘNG bởi scripts/audio-render.py — đừng sửa tay (chạy lại script để cập nhật).
 * Bảng các bản nhạc nền render sẵn (public/world/audio/<f>.ogg | .m4a) + stinger (sprite một file).
 * Kiểu dữ liệu + logic chọn / ghép câu: lib/world/musicStems.ts.
 */
import type { StingerSprite, TrackDef } from "./musicStems";

export const TRACKS: Record<string, TrackDef> = {
  "hubDay": {
    "id": "hubDay",
    "bpm": 80,
    "beats": 3,
    "bars": 8,
    "slotBars": 4,
    "root": 62,
    "scale": [
      0,
      2,
      4,
      5,
      7,
      9,
      11
    ],
    "chords": [
      [
        0,
        7,
        4
      ],
      [
        11,
        7,
        2
      ],
      [
        9,
        4,
        0,
        7
      ],
      [
        5,
        0,
        9,
        4
      ],
      [
        4,
        0,
        7
      ],
      [
        5,
        9,
        0
      ],
      [
        2,
        9,
        5,
        0
      ],
      [
        7,
        2,
        0
      ]
    ],
    "level": 0.62,
    "rest": 0.3,
    "bed": {
      "f": "hubDay_bed",
      "dur": 21.0
    },
    "cells": [
      {
        "f": "hubDay_c0a",
        "dur": 12.0,
        "slot": 0
      },
      {
        "f": "hubDay_c0b",
        "dur": 12.0,
        "slot": 0
      },
      {
        "f": "hubDay_c1a",
        "dur": 12.0,
        "slot": 1
      },
      {
        "f": "hubDay_c1b",
        "dur": 12.0,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  },
  "hubNight": {
    "id": "hubNight",
    "bpm": 66,
    "beats": 3,
    "bars": 8,
    "slotBars": 4,
    "root": 59,
    "scale": [
      0,
      2,
      3,
      5,
      7,
      8,
      10
    ],
    "chords": [
      [
        0,
        7,
        3,
        2
      ],
      [
        8,
        3,
        0,
        7
      ],
      [
        3,
        10,
        7
      ],
      [
        10,
        5,
        2
      ],
      [
        5,
        0,
        8,
        3
      ],
      [
        7,
        0,
        3
      ],
      [
        8,
        0,
        3
      ],
      [
        7,
        2,
        11
      ]
    ],
    "level": 0.6,
    "rest": 0.35,
    "bed": {
      "f": "hubNight_bed",
      "dur": 25.018
    },
    "cells": [
      {
        "f": "hubNight_c0a",
        "dur": 14.109,
        "slot": 0
      },
      {
        "f": "hubNight_c0b",
        "dur": 14.109,
        "slot": 0
      },
      {
        "f": "hubNight_c1a",
        "dur": 14.109,
        "slot": 1
      },
      {
        "f": "hubNight_c1b",
        "dur": 14.109,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  },
  "impossible": {
    "id": "impossible",
    "bpm": 62,
    "beats": 4,
    "bars": 8,
    "slotBars": 4,
    "root": 64,
    "scale": [
      0,
      2,
      3,
      5,
      7,
      8,
      10
    ],
    "chords": [
      [
        0,
        7,
        3
      ],
      [
        8,
        0,
        3
      ],
      [
        3,
        10,
        7
      ],
      [
        10,
        2,
        5
      ],
      [
        5,
        8,
        0
      ],
      [
        0,
        7,
        3
      ],
      [
        5,
        0,
        8
      ],
      [
        0,
        4,
        7
      ]
    ],
    "level": 0.62,
    "rest": 0.3,
    "bed": {
      "f": "impossible_bed",
      "dur": 35.468
    },
    "cells": [
      {
        "f": "impossible_c0a",
        "dur": 19.984,
        "slot": 0
      },
      {
        "f": "impossible_c0b",
        "dur": 19.984,
        "slot": 0
      },
      {
        "f": "impossible_c1a",
        "dur": 19.984,
        "slot": 1
      },
      {
        "f": "impossible_c1b",
        "dur": 19.984,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  },
  "siren": {
    "id": "siren",
    "bpm": 96,
    "beats": 4,
    "bars": 8,
    "slotBars": 4,
    "root": 60,
    "scale": [
      0,
      2,
      3,
      5,
      7,
      8,
      10
    ],
    "chords": [
      [
        0,
        7,
        3
      ],
      [
        8,
        3,
        0
      ],
      [
        3,
        7,
        10
      ],
      [
        10,
        5,
        2
      ],
      [
        5,
        0,
        8
      ],
      [
        1,
        5,
        8
      ],
      [
        7,
        2,
        5,
        11
      ],
      [
        0,
        7,
        4
      ]
    ],
    "level": 0.6,
    "rest": 0.25,
    "bed": {
      "f": "siren_bed",
      "dur": 22.6
    },
    "cells": [
      {
        "f": "siren_c0a",
        "dur": 12.6,
        "slot": 0
      },
      {
        "f": "siren_c0b",
        "dur": 12.6,
        "slot": 0
      },
      {
        "f": "siren_c1a",
        "dur": 12.6,
        "slot": 1
      },
      {
        "f": "siren_c1b",
        "dur": 12.6,
        "slot": 1
      }
    ],
    "layers": [
      {
        "f": "siren_dis",
        "dur": 22.6,
        "param": "dissonance"
      },
      {
        "f": "siren_boss",
        "dur": 22.6,
        "param": "boss"
      }
    ],
    "glitch": [
      {
        "f": "siren_g0",
        "dur": 3.7
      },
      {
        "f": "siren_g1",
        "dur": 2.5
      },
      {
        "f": "siren_g2",
        "dur": 3.5
      }
    ]
  },
  "boss": {
    "id": "boss",
    "bpm": 112,
    "beats": 4,
    "bars": 8,
    "slotBars": 4,
    "root": 62,
    "scale": [
      0,
      2,
      3,
      5,
      7,
      8,
      10
    ],
    "chords": [
      [
        0,
        7,
        3
      ],
      [
        8,
        3,
        0
      ],
      [
        5,
        0,
        8
      ],
      [
        7,
        2,
        11
      ],
      [
        0,
        7,
        3
      ],
      [
        3,
        10,
        7
      ],
      [
        10,
        5,
        2
      ],
      [
        7,
        2,
        11,
        5
      ]
    ],
    "level": 0.72,
    "rest": 0.15,
    "bed": {
      "f": "boss_bed",
      "dur": 19.543
    },
    "cells": [
      {
        "f": "boss_c0a",
        "dur": 10.971,
        "slot": 0
      },
      {
        "f": "boss_c0b",
        "dur": 10.971,
        "slot": 0
      },
      {
        "f": "boss_c1a",
        "dur": 10.971,
        "slot": 1
      },
      {
        "f": "boss_c1b",
        "dur": 10.971,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  },
  "expDay": {
    "id": "expDay",
    "bpm": 80,
    "beats": 4,
    "bars": 8,
    "slotBars": 4,
    "root": 67,
    "scale": [
      0,
      2,
      4,
      5,
      7,
      9,
      11
    ],
    "chords": [
      [
        0,
        7,
        4
      ],
      [
        11,
        7,
        2
      ],
      [
        9,
        4,
        0,
        7
      ],
      [
        5,
        0,
        7,
        9
      ],
      [
        4,
        7,
        0
      ],
      [
        5,
        9,
        0
      ],
      [
        2,
        9,
        0,
        5
      ],
      [
        7,
        2,
        5,
        11
      ]
    ],
    "level": 0.6,
    "rest": 0.3,
    "bed": {
      "f": "expDay_bed",
      "dur": 27.0
    },
    "cells": [
      {
        "f": "expDay_c0a",
        "dur": 15.0,
        "slot": 0
      },
      {
        "f": "expDay_c0b",
        "dur": 15.0,
        "slot": 0
      },
      {
        "f": "expDay_c1a",
        "dur": 15.0,
        "slot": 1
      },
      {
        "f": "expDay_c1b",
        "dur": 15.0,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  },
  "expNight": {
    "id": "expNight",
    "bpm": 64,
    "beats": 4,
    "bars": 8,
    "slotBars": 4,
    "root": 64,
    "scale": [
      0,
      2,
      3,
      5,
      7,
      8,
      10
    ],
    "chords": [
      [
        0,
        7,
        3,
        2
      ],
      [
        8,
        3,
        0,
        7
      ],
      [
        3,
        10,
        7
      ],
      [
        10,
        5,
        2
      ],
      [
        5,
        0,
        3,
        8
      ],
      [
        3,
        7,
        0
      ],
      [
        8,
        3,
        0
      ],
      [
        7,
        2,
        11
      ]
    ],
    "level": 0.58,
    "rest": 0.35,
    "bed": {
      "f": "expNight_bed",
      "dur": 33.4
    },
    "cells": [
      {
        "f": "expNight_c0a",
        "dur": 18.4,
        "slot": 0
      },
      {
        "f": "expNight_c0b",
        "dur": 18.4,
        "slot": 0
      },
      {
        "f": "expNight_c1a",
        "dur": 18.4,
        "slot": 1
      },
      {
        "f": "expNight_c1b",
        "dur": 18.4,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  },
  "archive": {
    "id": "archive",
    "bpm": 54,
    "beats": 4,
    "bars": 6,
    "slotBars": 3,
    "root": 62,
    "scale": [
      0,
      1,
      3,
      5,
      7,
      8,
      10
    ],
    "chords": [
      [
        0,
        7,
        3
      ],
      [
        0,
        7,
        3
      ],
      [
        0,
        7,
        3
      ],
      [
        0,
        1,
        5,
        8
      ],
      [
        0,
        1,
        5,
        8
      ],
      [
        0,
        1,
        5,
        8
      ]
    ],
    "level": 0.6,
    "rest": 0.45,
    "bed": {
      "f": "archive_bed",
      "dur": 31.167
    },
    "cells": [
      {
        "f": "archive_c0a",
        "dur": 17.833,
        "slot": 0
      },
      {
        "f": "archive_c0b",
        "dur": 17.833,
        "slot": 0
      },
      {
        "f": "archive_c1a",
        "dur": 17.833,
        "slot": 1
      },
      {
        "f": "archive_c1b",
        "dur": 17.833,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  },
  "study": {
    "id": "study",
    "bpm": 70,
    "beats": 4,
    "bars": 8,
    "slotBars": 4,
    "root": 65,
    "scale": [
      0,
      2,
      4,
      5,
      7,
      9,
      11
    ],
    "chords": [
      [
        0,
        7,
        4
      ],
      [
        11,
        7,
        2
      ],
      [
        9,
        4,
        0,
        7
      ],
      [
        5,
        0,
        9,
        4
      ],
      [
        4,
        0,
        7
      ],
      [
        5,
        0,
        9
      ],
      [
        2,
        0,
        5,
        9
      ],
      [
        7,
        2,
        11
      ]
    ],
    "level": 0.45,
    "rest": 0.4,
    "bed": {
      "f": "study_bed",
      "dur": 30.029
    },
    "cells": [
      {
        "f": "study_c0a",
        "dur": 16.314,
        "slot": 0
      },
      {
        "f": "study_c0b",
        "dur": 16.314,
        "slot": 0
      },
      {
        "f": "study_c1a",
        "dur": 16.314,
        "slot": 1
      },
      {
        "f": "study_c1b",
        "dur": 16.314,
        "slot": 1
      }
    ],
    "layers": [],
    "glitch": []
  }
};

export const STINGERS: StingerSprite = {
  "f": "stingers",
  "root": 62,
  "cues": {
    "amen": {
      "at": 0.0,
      "dur": 4.2
    },
    "victory": {
      "at": 4.45,
      "dur": 4.6
    },
    "defeat": {
      "at": 9.3,
      "dur": 3.8
    },
    "bossReveal": {
      "at": 13.35,
      "dur": 4.4
    },
    "portal": {
      "at": 18.0,
      "dur": 3.2
    }
  }
};
