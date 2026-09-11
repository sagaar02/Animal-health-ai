# Animal Health AI 🐾

**Animal Health AI** is a professional-grade veterinary diagnostic tool designed to provide real-time health assessments for animals. Using advanced AI models like YOLO for detection and adaptive pose analysis, the application identifies visual anomalies, movement patterns, and provides clinical-grade reporting for veterinary professionals and animal owners.

## 🚀 Getting Started

### Prerequisites
- Node.js (Latest LTS)
- Supabase account (for backend services)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sudharshan-29/Animal-Health-AI.git
   cd Animal-Health-AI
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   For security reasons, the `.env` file containing sensitive API keys has been removed from this repository. To get the application running on your system:
   - Locate the `.env.example` file in the root directory.
   - Create a new file named `.env` in the root directory.
   - Copy the contents of `.env.example` into your new `.env` file.
   - Fill in your own Supabase project credentials (`VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_URL`).

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 🛠 Features
- **Real-time Pose Analysis**: High-fidelity kinematic tracking for detecting gait issues and injuries.
- **AI Diagnostics**: Vision AI for identifying lesions, fractures, and other visual health markers.
- **Clinical Reports**: Detailed, structured PDF-ready reports for veterinary assessments.
- **Adaptive Detection**: Optimized for various animal types and camera angles.

---
*Developed with a focus on animal welfare and advanced veterinary technology.*
