"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
// Add this import at the top if 'docx' is installed:
// import { Document, Packer, Paragraph, TextRun } from "docx";
// If not installed, instruct user to install: npm install docx file-saver

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [diarization, setDiarization] = useState<any[] | null>(null);
  const [diarizing, setDiarizing] = useState(false);
  const [diarizationError, setDiarizationError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  // Handle recording
  const startRecording = async () => {
    setRecordedChunks([]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new window.MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) setRecordedChunks((prev) => [...prev, e.data]);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "audio/webm" });
      setAudioFile(new File([blob], "recording.webm"));
      setAudioUrl(URL.createObjectURL(blob));
    };
    setMediaRecorder(recorder);
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  const transcribeAudio = async () => {
    if (!audioFile) return;
    setLoading(true);
    setError(null);
    setTranscript(null);
    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      const res = await fetch("https://whisper.lablab.ai/asr", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setTranscript(data.text || "No transcript returned.");
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const diarizeAudio = async () => {
    if (!audioFile) return;
    setDiarizing(true);
    setDiarizationError(null);
    setDiarization(null);
    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      // Hugging Face Space expects a JSON payload with 'data' array containing the file
      const payload = new FormData();
      payload.append("data", audioFile);
      const res = await fetch("https://hf.space/embed/k2-fsa/speaker-diarization/api/predict/", {
        method: "POST",
        body: payload,
      });
      if (!res.ok) throw new Error("Diarization failed");
      const data = await res.json();
      // The result is in data.data[0], an array of segments: [start, end, speaker, text]
      setDiarization(data.data[0] || []);
    } catch (err: any) {
      setDiarizationError(err.message || "Unknown error");
    } finally {
      setDiarizing(false);
    }
  };

  const translateTranscript = async () => {
    if (!transcript) return;
    setTranslating(true);
    setTranslationError(null);
    setTranslation(null);
    try {
      const res = await fetch("https://hf.space/embed/julien-c/nllb-translation-in-browser/api/predict/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [transcript, "auto", "eng_Latn"] }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      setTranslation(data.data[0] || "No translation returned.");
    } catch (err: any) {
      setTranslationError(err.message || "Unknown error");
    } finally {
      setTranslating(false);
    }
  };

  const summarizeText = async () => {
    const textToSummarize = translation || transcript;
    if (!textToSummarize) return;
    setSummarizing(true);
    setSummaryError(null);
    setSummary(null);
    try {
      const res = await fetch("https://hf.space/embed/pszemraj/summarize-long-text/api/predict/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [textToSummarize] }),
      });
      if (!res.ok) throw new Error("Summarization failed");
      const data = await res.json();
      setSummary(data.data[0] || "No summary returned.");
    } catch (err: any) {
      setSummaryError(err.message || "Unknown error");
    } finally {
      setSummarizing(false);
    }
  };

  // Download as .txt
  const handleDownloadTxt = async () => {
    let content = "";
    if (diarization && diarization.length > 0) {
      content += "--- Speaker Diarization ---\n";
      diarization.forEach((seg) => {
        content += `Speaker ${seg[2]} [${seg[0].toFixed(1)}s - ${seg[1].toFixed(1)}s]:\n${seg[3]}\n\n`;
      });
    }
    if (transcript) {
      content += "--- Transcript ---\n" + transcript + "\n\n";
    }
    if (translation) {
      content += "--- English Translation ---\n" + translation + "\n\n";
    }
    if (summary) {
      content += "--- Meeting Summary ---\n" + summary + "\n";
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const { saveAs } = await import("file-saver");
    saveAs(blob, "meeting_transcript.txt");
  };

  // Download as .docx
  const handleDownloadDocx = async () => {
    // Only run if 'docx' is installed
    try {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const { saveAs } = await import("file-saver");
      const children = [];
      if (diarization && diarization.length > 0) {
        children.push(new Paragraph({ text: "Speaker Diarization", heading: "Heading1" }));
        diarization.forEach((seg) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Speaker ${seg[2]} [${seg[0].toFixed(1)}s - ${seg[1].toFixed(1)}s]:`, bold: true }),
                new TextRun({ text: "\n" + seg[3] }),
              ],
            })
          );
        });
      }
      if (transcript) {
        children.push(new Paragraph({ text: "Transcript", heading: "Heading1" }));
        children.push(new Paragraph(transcript));
      }
      if (translation) {
        children.push(new Paragraph({ text: "English Translation", heading: "Heading1" }));
        children.push(new Paragraph(translation));
      }
      if (summary) {
        children.push(new Paragraph({ text: "Meeting Summary", heading: "Heading1" }));
        children.push(new Paragraph(summary));
      }
      const doc = new Document({
        sections: [
          {
            children,
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, "meeting_transcript.docx");
    } catch (e) {
      alert("docx or file-saver package not installed. Please run: npm install docx file-saver");
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* Audio Upload/Record UI */}
        <section style={{ marginBottom: 32, width: "100%", maxWidth: 500 }}>
          <h2>Upload or Record Meeting Audio</h2>
          <input
            type="file"
            accept="audio/*"
            ref={audioInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            onClick={() => audioInputRef.current?.click()}
            style={{ marginRight: 12 }}
          >
            Upload Audio File
          </button>
          {!recording ? (
            <button onClick={startRecording}>Record Audio</button>
          ) : (
            <button onClick={stopRecording} style={{ color: "red" }}>
              Stop Recording
            </button>
          )}
          {audioUrl && (
            <div style={{ marginTop: 16 }}>
              <audio controls src={audioUrl} style={{ width: "100%" }} />
              <div style={{ fontSize: 12, color: "#666" }}>
                {audioFile?.name}
              </div>
              <button
                onClick={transcribeAudio}
                disabled={loading}
                style={{ marginTop: 16 }}
              >
                {loading ? "Transcribing..." : "Transcribe Audio"}
              </button>
              {error && (
                <div style={{ color: "red", marginTop: 8 }}>{error}</div>
              )}
              {transcript && (
                <div style={{ marginTop: 16 }}>
                  <h3>Transcript</h3>
                  <div
                    style={{
                      background: "#f5f5f5",
                      padding: 12,
                      borderRadius: 6,
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                    }}
                  >
                    {transcript}
                  </div>
                  <button
                    onClick={diarizeAudio}
                    disabled={diarizing}
                    style={{ marginTop: 16 }}
                  >
                    {diarizing ? "Diarizing..." : "Identify Speakers"}
                  </button>
                  {diarizationError && (
                    <div style={{ color: "red", marginTop: 8 }}>{diarizationError}</div>
                  )}
                  {diarization && diarization.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <h3>Speaker Diarization</h3>
                      <div
                        style={{
                          background: "#e8f0fe",
                          padding: 12,
                          borderRadius: 6,
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                        }}
                      >
                        {diarization.map((seg, i) => (
                          <div key={i} style={{ marginBottom: 8 }}>
                            <b>Speaker {seg[2]}</b> [{seg[0].toFixed(1)}s - {seg[1].toFixed(1)}s]:<br />
                            {seg[3]}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={translateTranscript}
                    disabled={translating}
                    style={{ marginTop: 16 }}
                  >
                    {translating ? "Translating..." : "Translate to English"}
                  </button>
                  {translationError && (
                    <div style={{ color: "red", marginTop: 8 }}>{translationError}</div>
                  )}
                  {translation && (
                    <div style={{ marginTop: 16 }}>
                      <h3>English Translation</h3>
                      <div
                        style={{
                          background: "#f0f8e8",
                          padding: 12,
                          borderRadius: 6,
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                        }}
                      >
                        {translation}
                      </div>
                      <button
                        onClick={summarizeText}
                        disabled={summarizing}
                        style={{ marginTop: 16 }}
                      >
                        {summarizing ? "Summarizing..." : "Summarize Meeting"}
                      </button>
                      {summaryError && (
                        <div style={{ color: "red", marginTop: 8 }}>{summaryError}</div>
                      )}
                      {summary && (
                        <div style={{ marginTop: 16 }}>
                          <h3>Meeting Summary</h3>
                          <div
                            style={{
                              background: "#f8f0e8",
                              padding: 12,
                              borderRadius: 6,
                              whiteSpace: "pre-wrap",
                              fontFamily: "monospace",
                            }}
                          >
                            {summary}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        {/* Download buttons */}
        {(transcript || translation || summary) && (
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button onClick={handleDownloadTxt}>Download as .txt</button>
            <button onClick={handleDownloadDocx}>Download as .docx</button>
          </div>
        )}
        <Image
          className={styles.logo}
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol>
          <li>
            Get started by editing <code>src/app/page.tsx</code>.
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className={styles.logo}
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondary}
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className={styles.footer}>
        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
