# Bitbon Viking Academy

**Курс трансформації у Web 4.0**

Professional e-learning platform for the Bitbon System Web 4.0 transformation course. Built with React + Vite.

---

## Features

### Learning Experience
- **12 modules** covering Web 2.0 → Web 4.0 evolution, Bitbon architecture, digital sovereignty, tokenization, and strategy
- **Lecturer transitions** with typewriter animation between topics and modules (40+ unique texts by Oleksandr Kud)
- **Module intro/outro system** — each module starts with a lecturer address and ends with a summary
- **PDF slide viewer** with zoom, grid view, slide navigation, and per-slide notes
- **Skill Tree** — SVG dependency graph showing module prerequisites
- **Victory animation** — confetti and XP reward on module completion

### UX / Ergonomics
- **Focus Mode** — collapses sidebar and hides right panel for distraction-free learning
- **Resume Learning** — remembers last position, one-click to continue
- **Global Search** (Ctrl+K) — instant search across all 40+ topics
- **Collapsing sticky header** — shrinks on scroll to maximize content area
- **Topic progress tracking** — micro progress bars, reading time estimates, completion badges
- **Contextual sidebar** — changes content based on active tab (Topics/Practice/Outcome/Overview)

### Visual Design
- Dark Bitbon theme (`#070C18` background, `#4A9EFF` accent)
- Fonts: Exo 2 (display) + DM Sans (body)
- Hexagonal background pattern
- Animated shimmer tagline
- Unique accent colors per module
- Responsive layout with 3 sidebar modes (full / icons / hidden)

---

## Project Structure

```
bitbon-viking-academy/
├── index.html                  # Entry point
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg             # Bitbon geometric logo
└── src/
    ├── main.jsx                # React mount
    ├── index.css               # Global styles & animations
    ├── App.jsx                 # Main application component
    ├── data/
    │   ├── constants.js        # Colors, timing constants
    │   ├── modules.js          # 12 course modules data
    │   ├── transitions.js      # Lecturer texts (intros, outros, transitions)
    │   └── slides.js           # PDF presentation (base64 JPEG, ~1.3 MB)
    └── components/
        ├── BitbonLogo.jsx      # SVG Bitbon geometric logo
        ├── ProgressRing.jsx    # Circular progress indicator
        ├── GeoBg.jsx           # Hexagonal background pattern
        ├── Victory.jsx         # Confetti celebration animation
        ├── SearchModal.jsx     # Global search overlay (Ctrl+K)
        ├── SkillTree.jsx       # SVG module dependency graph
        ├── LecturerTransition.jsx  # Between-topic lecturer messages
        ├── IntroOutroModal.jsx     # Module start/end lecturer messages
        ├── PdfViewer.jsx           # Slide viewer with zoom/grid/notes
        └── ContextualSidebar.jsx   # Tab-dependent right panel
```

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/bitbon-viking-academy.git
cd bitbon-viking-academy

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Course Modules

| #  | Module | Topic |
|----|--------|-------|
| 01 | 🌐 Еволюція Інтернету | Web 2.0 → Web 4.0 |
| 02 | ⚙️ Архітектура Системи | Bitbon infrastructure |
| 03 | 🔐 Цифровий суверенітет | Self-Sovereign Identity |
| 04 | ⭐ Аурократія | Reputation as capital |
| 05 | 🏢 Токенізація бізнесу | Asset lifecycle tokenization |
| 06 | 🔗 Масштабованість | Sharding & segmentation |
| 07 | 💳 Фінансові шлюзи | eDAC & Regional Operators |
| 08 | 🤖 Сервіси Екосистеми | AI assistant iO & MetaMarket |
| 09 | 📈 Економічна стійкість | Bitbon economics & funding |
| 10 | 🚀 Стратегія 2025-2035 | Decentralization roadmap |
| 11 | 🎁 Бонус | Practical tips & checklist |
| 12 | 🏁 ПІДСУМОК | Choose your path: Business / Expert / Investor |

---

## Tech Stack

- **React 18** — UI framework
- **Vite 5** — build tool
- **Pure CSS** — no external UI libraries
- **SVG** — logos, skill tree, geometric backgrounds

---

## Ideologue

**Oleksandr Kud** — CEO of Simcord, Bitbon System ideologue.

All lecturer transition texts authored by Oleksandr Kud.

---

## License

MIT
