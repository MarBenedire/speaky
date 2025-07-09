# Speaky: Instant Meeting Transcription App

**Deploy instantly to Vercel. No API keys, no config, no setup.**

## Features
- Upload or record meeting audio (any language)
- Auto-transcribe using open-source Whisper (public endpoint)
- Auto-detect and label speakers (diarization)
- Translate transcript to English (public endpoint)
- Summarize meeting into minutes (public endpoint)
- Download full transcript + summary as .txt or .docx
- 100% free, no login, no environment variables

## One-Click Deploy
1. `git clone <repo-url>`
2. Import to [Vercel](https://vercel.com/import) (or run `vercel --prod`)
3. Done! The app works instantly.

## Local Development
```bash
npm install
npm run dev
```

## How it works
- All AI features use public, free Hugging Face Spaces (no API key required)
- No backend or server config needed
- Works out of the box after deploy

---

**Enjoy your free, production-ready meeting transcription app!**
