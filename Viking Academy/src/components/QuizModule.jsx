import { useState } from "react";

const STATES = { IDLE: "idle", ANSWERED: "answered", DONE: "done" };

export default function QuizModule({ quizData, accentColor, onComplete }) {
  const [step, setStep] = useState(STATES.IDLE);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState([]);

  const { questions, title, passingScore = 70 } = quizData;
  const current = questions[qIdx];
  const total = questions.length;
  const progress = ((qIdx + (step === STATES.ANSWERED ? 1 : 0)) / total) * 100;

  const handleSelect = (idx) => {
    if (step === STATES.ANSWERED) return;
    setSelected(idx);
    const isCorrect = idx === current.correct;
    if (isCorrect) {
      setScore(s => s + 1);
    } else {
      setWrongAnswers(w => [...w, qIdx]);
    }
    setStep(STATES.ANSWERED);
  };

  const handleNext = () => {
    if (qIdx + 1 >= total) {
      setStep(STATES.DONE);
    } else {
      setQIdx(i => i + 1);
      setSelected(null);
      setStep(STATES.IDLE);
    }
  };

  const handleRetry = () => {
    setQIdx(0);
    setSelected(null);
    setScore(0);
    setWrongAnswers([]);
    setStep(STATES.IDLE);
  };

  const pct = Math.round((score / total) * 100);
  const passed = pct >= passingScore;

  const OPTION_LABELS = ["A", "B", "C", "D"];

  if (step === STATES.DONE) {
    return (
      <div style={{ animation: "fadeUp 0.4s ease" }}>
        {/* Result card */}
        <div style={{
          padding: 28, borderRadius: 16, marginBottom: 16, textAlign: "center",
          background: passed ? "rgba(0,200,160,0.08)" : "rgba(255,107,107,0.08)",
          border: `2px solid ${passed ? "rgba(0,200,160,0.4)" : "rgba(255,107,107,0.35)"}`
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{passed ? "🏆" : "📚"}</div>
          <div style={{
            fontFamily: "'Exo 2',sans-serif", fontSize: 28, fontWeight: 800,
            color: passed ? "#00C8A0" : "#FF6B6B", marginBottom: 4
          }}>
            {score} / {total}
          </div>
          <div style={{ fontSize: 13, color: "rgba(160,180,220,0.7)", marginBottom: 12 }}>
            правильних відповідей ({pct}%)
          </div>
          <div style={{
            display: "inline-block", padding: "6px 18px", borderRadius: 20,
            background: passed ? "rgba(0,200,160,0.15)" : "rgba(255,107,107,0.12)",
            color: passed ? "#00C8A0" : "#FF8080", fontSize: 13, fontWeight: 700
          }}>
            {passed ? "✓ Тест пройдено" : "✗ Потрібно повторити матеріал"}
          </div>
        </div>

        {/* Score bar */}
        <div style={{ padding: "14px 18px", background: "rgba(13,21,38,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(160,180,220,0.5)", marginBottom: 6 }}>
            <span>Прогрес</span><span>{pct}% / потрібно {passingScore}%</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`, borderRadius: 3, transition: "width 1s ease",
              background: passed
                ? "linear-gradient(90deg,#00C8A0,#38BDF8)"
                : `linear-gradient(90deg,${accentColor},${accentColor}99)`
            }} />
          </div>
        </div>

        {/* Wrong answers list */}
        {wrongAnswers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(160,180,220,0.4)", fontWeight: 700, marginBottom: 8 }}>
              Повтори ці теми:
            </div>
            {wrongAnswers.map(wi => (
              <div key={wi} style={{
                padding: "9px 14px", background: "rgba(255,107,107,0.06)",
                border: "1px solid rgba(255,107,107,0.2)", borderRadius: 9, marginBottom: 6,
                fontSize: 12, color: "rgba(200,210,230,0.8)", display: "flex", gap: 8
              }}>
                <span style={{ color: "#FF8080", fontWeight: 700 }}>✗</span>
                {questions[wi].q}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleRetry} style={{
            flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
            color: "rgba(160,180,220,0.7)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif"
          }}>
            ↺ Пройти знову
          </button>
          {passed && (
            <button onClick={onComplete} style={{
              flex: 1, padding: "12px",
              background: `linear-gradient(135deg,${accentColor},${accentColor}99)`,
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 4px 20px ${accentColor}40`, fontFamily: "'DM Sans',sans-serif"
            }}>
              ✓ Завершити модуль
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeUp 0.35s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: accentColor }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "rgba(160,180,220,0.5)" }}>
          {qIdx + 1} / {total}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 24 }}>
        <div style={{
          height: "100%", width: `${progress}%`, borderRadius: 2,
          background: `linear-gradient(90deg,${accentColor},${accentColor}80)`,
          transition: "width 0.4s ease"
        }} />
      </div>

      {/* Question */}
      <div style={{
        padding: "20px 22px", background: `${accentColor}0A`,
        border: `1px solid ${accentColor}30`, borderRadius: 14, marginBottom: 18
      }}>
        <div style={{
          fontFamily: "'Exo 2',sans-serif", fontSize: 16, fontWeight: 700,
          lineHeight: 1.5, color: "rgba(220,230,250,1)"
        }}>
          {current.q}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
        {current.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === current.correct;
          const isAnswered = step === STATES.ANSWERED;

          let bg = "rgba(13,21,38,0.8)";
          let border = "1px solid rgba(255,255,255,0.08)";
          let labelBg = "rgba(255,255,255,0.06)";
          let labelColor = "rgba(160,180,220,0.6)";
          let textColor = "rgba(200,215,240,0.85)";
          let icon = null;

          if (isAnswered) {
            if (isCorrect) {
              bg = "rgba(0,200,160,0.1)";
              border = "1px solid rgba(0,200,160,0.45)";
              labelBg = "rgba(0,200,160,0.2)";
              labelColor = "#00C8A0";
              textColor = "rgba(220,240,235,1)";
              icon = "✓";
            } else if (isSelected) {
              bg = "rgba(255,100,100,0.1)";
              border = "1px solid rgba(255,100,100,0.4)";
              labelBg = "rgba(255,100,100,0.2)";
              labelColor = "#FF8080";
              textColor = "rgba(240,210,210,0.9)";
              icon = "✗";
            }
          }

          return (
            <button key={i} onClick={() => handleSelect(i)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px", background: bg, border, borderRadius: 11,
              cursor: isAnswered ? "default" : "pointer", textAlign: "left",
              transition: "all 0.2s", fontFamily: "'DM Sans',sans-serif",
              transform: "none", animation: isAnswered && isCorrect ? "fadeUp 0.25s ease" : "none"
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: labelBg, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: labelColor,
                fontFamily: "'Exo 2',sans-serif", transition: "all 0.2s"
              }}>
                {icon || OPTION_LABELS[i]}
              </div>
              <span style={{ fontSize: 13, color: textColor, lineHeight: 1.5 }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation + Next */}
      {step === STATES.ANSWERED && (
        <div style={{ animation: "fadeUp 0.3s ease" }}>
          <div style={{
            padding: "12px 16px", marginBottom: 14,
            background: selected === current.correct ? "rgba(0,200,160,0.08)" : "rgba(74,158,255,0.08)",
            border: `1px solid ${selected === current.correct ? "rgba(0,200,160,0.25)" : "rgba(74,158,255,0.25)"}`,
            borderRadius: 10, fontSize: 12, color: "rgba(180,200,230,0.8)", lineHeight: 1.6
          }}>
            <span style={{ fontWeight: 700, color: selected === current.correct ? "#00C8A0" : "#4A9EFF", marginRight: 6 }}>
              {selected === current.correct ? "✓ Правильно!" : "💡 Пояснення:"}
            </span>
            {current.explanation}
          </div>
          <button onClick={handleNext} style={{
            width: "100%", padding: "13px",
            background: `linear-gradient(135deg,${accentColor},${accentColor}80)`,
            border: "none", borderRadius: 11, color: "#fff",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
            boxShadow: `0 4px 16px ${accentColor}35`, fontFamily: "'DM Sans',sans-serif"
          }}>
            {qIdx + 1 >= total ? "Завершити тест →" : "Далі →"}
          </button>
        </div>
      )}
    </div>
  );
}
