# Orchid Resort - Installation Guide (Git Workflow)

This guide describes how to install and run the Orchid Resort Management System on a new machine using Git.

## Prerequisites

- **Git** (Download from git-scm.com)
- **Python 3.9+** (Ensure `python` and `pip` are in your PATH)
- **Node.js 16+** and `npm`
- **PostgreSQL 13+**

## 1. Get the Code

1. Open your terminal or command prompt.
2. Clone the repository:
   ```bash
   git clone https://github.com/teqmatessolutions-gif/ResortwithGstinventry.git
   ```
3. Navigate into the project directory:
   ```bash
   cd ResortwithGstinventry
   ```
4. Checkout the correct branch (if not already on it):
   ```bash
   git checkout orchid_latest
   ```

## 2. Database Setup

1. Install PostgreSQL and create a new database (e.g., `orchid_db`).
2. Make sure you have the credentials (username, password, host, port).

## 3. Backend Setup

The backend is built with Python FastAPI.

1. Navigate to the backend directory:
   ```bash
   cd ResortApp
   ```

2. Create a virtual environment (Recommended):
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux/Mac
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create `.env` file:
   Create a file named `.env` in the `ResortApp` folder with the following content:
   ```ini
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/orchid_db
   SECRET_KEY=your_secret_key_change_this
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   ```
   *Update `DATABASE_URL` with your actual DB credentials.*

5. Initialize the Database & Data:
   Run the following scripts in order to create the admin user and accounting structure:

   ```bash
   # Create Default Admin User (Default: admin@orchid.com / admin123)
   python create_admin.py
   
   # Create Default Chart of Accounts (CRITICAL for Accounting)
   python setup_chart_of_accounts.py
   ```

6. Start the Backend Server:
   ```bash
   # Windows
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8011
   ```

   Backend will be running at `http://localhost:8011`.

## 4. Frontend Setup

The frontend is built with React.

1. Open a new terminal tab.
2. Navigate to the frontend directory:
   ```bash
   cd dasboard
   ```
   *(Note: The directory name is `dasboard`, check spelling)*

3. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

4. Start the Frontend Development Server:
   ```bash
   npm start
   ```

   Frontend will generally run at `http://localhost:3000`.

## 5. Verification

1. Open `http://localhost:3000` in your browser.
2. Login with:
   - Email: `admin@orchid.com`
   - Password: `admin123`
3. Navigate to **Accounting > Chart of Accounts** to verify ledgers are loaded.

## Troubleshooting

- **Database Connection Error:** Check `DATABASE_URL` in `.env`. Ensure PostgreSQL service is running.
- **Missing Ledgers?** Run `python setup_chart_of_accounts.py` again.
- **Port Conflicts?** Ensure ports 8011 and 3000 are free.
