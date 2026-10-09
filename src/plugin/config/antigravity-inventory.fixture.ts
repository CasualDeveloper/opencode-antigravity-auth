import type { AntigravityModelInventory } from "./models";

/** Sanitized `fetchAvailableModels` response captured 2026-10-15 (quota and experiment data removed). */
export const ANTIGRAVITY_INVENTORY_FIXTURE: AntigravityModelInventory = {
  "models": {
    "chat_20706": {
      "isInternal": true,
      "maxTokens": 16384
    },
    "chat_23310": {
      "isInternal": true,
      "maxTokens": 32768
    },
    "claude-opus-4-6-thinking": {
      "displayName": "Claude Opus 4.6 (Thinking)",
      "maxTokens": 250000,
      "maxOutputTokens": 64000,
      "supportsImages": true,
      "tagTitle": "Notice",
      "tagDescription": "Opus 5.5 is now available on paid Pro and Ultra plans. Third-party model access will no longer be available on your current plan starting on November 2, 2026.",
      "supportedMimeTypes": {
        "image/heic": true,
        "video/jpeg2000": true
      }
    },
    "claude-sonnet-4-6": {
      "displayName": "Claude Sonnet 4.6 (Thinking)",
      "maxTokens": 250000,
      "maxOutputTokens": 64000,
      "supportsImages": true,
      "tagTitle": "Notice",
      "tagDescription": "Sonnet 5.5 is now available on paid Pro and Ultra plans. Third-party model access will no longer be available on your current plan starting on November 2, 2026.",
      "supportedMimeTypes": {
        "image/heic": true,
        "video/jpeg2000": true
      }
    },
    "gemini-2.5-flash": {
      "displayName": "Gemini 3.5 Flash Lite",
      "maxTokens": 1048576,
      "maxOutputTokens": 65535,
      "supportsImages": true,
      "supportsVideo": true,
      "tagDescription": "gemini-3.5-flash-lite",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-2.5-flash-lite": {
      "displayName": "Gemini 3.5 Flash Lite",
      "maxTokens": 1048576,
      "maxOutputTokens": 65535,
      "supportsImages": true,
      "supportsVideo": true,
      "tagDescription": "gemini-3.5-flash-lite",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-2.5-flash-thinking": {
      "displayName": "Gemini 3.5 Flash Lite",
      "maxTokens": 1048576,
      "maxOutputTokens": 65535,
      "supportsImages": true,
      "supportsVideo": true,
      "tagDescription": "gemini-3.5-flash-lite",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-2.5-pro": {
      "displayName": "Gemini 2.5 Pro",
      "maxTokens": 1048576,
      "maxOutputTokens": 65535,
      "supportsImages": true,
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3-flash": {
      "displayName": "Gemini 3 Flash",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3-flash-agent": {
      "displayName": "Gemini 3.5 Flash (High)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.1-flash-image": {
      "displayName": "Gemini 3.1 Flash Image"
    },
    "gemini-3.1-flash-lite": {
      "displayName": "Gemini 3.1 Flash Lite",
      "maxTokens": 1048576,
      "maxOutputTokens": 65535
    },
    "gemini-3.1-pro-high": {
      "displayName": "Gemini 3.1 Pro (High)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65535,
      "supportsImages": true,
      "supportsVideo": true,
      "tagTitle": "Leaving Soon",
      "tagDescription": "Use Gemini 3.8 Flash! As a newer model, it delivers more intelligence at 2x the speed for 70% less cost than Gemini 3.1 Pro.",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.1-pro-low": {
      "displayName": "Gemini 3.1 Pro (Low)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "tagTitle": "Leaving Soon",
      "tagDescription": "Use Gemini 3.8 Flash! As a newer model, it delivers more intelligence at 2x the speed for 70% less cost than Gemini 3.1 Pro.",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.5-flash-extra-low": {
      "displayName": "Gemini 3.5 Flash (Low)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.5-flash-lite": {
      "displayName": "Gemini 3.5 Flash Lite",
      "maxTokens": 1048576,
      "maxOutputTokens": 65535,
      "supportsImages": true,
      "supportsVideo": true,
      "tagDescription": "gemini-3.5-flash-lite",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.5-flash-low": {
      "displayName": "Gemini 3.5 Flash (Medium)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.6-flash-high": {
      "displayName": "Gemini 3.6 Flash (High)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "tagTitle": "Leaving Soon",
      "tagDescription": "Start using Gemini 3.8 Flash, our best Flash model.",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.6-flash-low": {
      "displayName": "Gemini 3.6 Flash (Low)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "tagTitle": "Leaving Soon",
      "tagDescription": "Start using Gemini 3.8 Flash, our best Flash model.",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.6-flash-medium": {
      "displayName": "Gemini 3.6 Flash (Medium)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "tagTitle": "Leaving Soon",
      "tagDescription": "Start using Gemini 3.8 Flash, our best Flash model.",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-3.8-flash-tiered": {
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gemini-pro-agent": {
      "displayName": "Gemini 3.1 Pro (High)",
      "maxTokens": 1048576,
      "maxOutputTokens": 65536,
      "supportsImages": true,
      "supportsVideo": true,
      "tagTitle": "Leaving Soon",
      "tagDescription": "Use Gemini 3.8 Flash! As a newer model, it delivers more intelligence at 2x the speed for 70% less cost than Gemini 3.1 Pro.",
      "supportedMimeTypes": {
        "image/heic": true,
        "application/pdf": true,
        "audio/aac": true,
        "video/audio/s16le": true
      }
    },
    "gpt-oss-120b-medium": {
      "displayName": "GPT-OSS 120B (Medium)",
      "maxTokens": 131072,
      "maxOutputTokens": 32768,
      "tagTitle": "Notice",
      "tagDescription": "GPT-OSS will be removed from Antigravity on November 2, 2026."
    },
    "tab_flash_lite_preview": {
      "maxTokens": 16384,
      "maxOutputTokens": 4096
    },
    "tab_jump_flash_lite_preview": {
      "maxTokens": 16384,
      "maxOutputTokens": 4096
    }
  },
  "agentModelSorts": [
    {
      "groups": [
        {
          "modelIds": [
            "gemini-3.6-flash-high",
            "gemini-3.6-flash-medium",
            "gemini-3.6-flash-low",
            "gemini-pro-agent",
            "gemini-3.1-pro-low",
            "claude-sonnet-4-6",
            "claude-opus-4-6-thinking",
            "gpt-oss-120b-medium"
          ]
        }
      ]
    }
  ],
  "commandModelIds": [
    "gemini-3-flash"
  ],
  "tabModelIds": [
    "chat_20706",
    "chat_23310"
  ],
  "imageGenerationModelIds": [
    "gemini-3.1-flash-image"
  ],
  "mqueryModelIds": [
    "gemini-3.5-flash-lite"
  ],
  "webSearchModelIds": [
    "gemini-3.1-flash-lite"
  ],
  "deprecatedModelIds": {
    "gemini-3.1-pro-high": {
      "newModelId": "gemini-pro-agent"
    }
  },
  "commitMessageModelIds": [
    "gemini-3.5-flash-lite"
  ],
  "tieredModelIds": {
    "flashLite": [
      "gemini-3.5-flash-lite"
    ],
    "flash": [
      "gemini-3.8-flash-tiered"
    ],
    "pro": [
      "gemini-3.1-pro-low"
    ]
  }
};
