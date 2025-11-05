# Task Manager Web App with AI

A comprehensive task management web application with Firebase authentication, real-time database, and **AI-powered features** using OpenAI GPT-4.

## 🤖 **NEW: AI Features**

### **AI Capabilities:**
- ✅ **Task Timeline Prediction** - AI analyzes tasks and predicts realistic timelines
- ✅ **Staff Workload Optimization** - Smart task assignment to prevent overload
- ✅ **Strategic Business Advice** - VIP advisory system for business decisions
- ✅ **Complexity Analysis** - Automatic task complexity assessment
- ✅ **Risk Identification** - AI identifies potential project risks

## Project Information
- **Project Name**: Task
- **Project ID**: task-582ac
- **Project Number**: 234394879623
- **Public Name**: Task-01
- **Support Email**: infinitydisigner@gmail.com

## Features

✅ **User Authentication**
- Sign up with email/password
- Login/Logout functionality
- Protected routes

✅ **Task Management (CRUD Operations)**
- **Create**: Add new tasks with title, description, and status
- **Read**: View all your tasks in real-time
- **Update**: Edit existing tasks
- **Delete**: Remove tasks with confirmation

✅ **Task Status Tracking**
- Pending
- In Progress
- Completed

✅ **Modern UI**
- Responsive design
- Clean and intuitive interface
- Status color coding

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (ES6+)
- **Build Tool**: Vite
- **Backend**: Firebase
  - Firebase Authentication
  - Cloud Firestore Database
  - **Cloud Functions** (Serverless)
- **AI**: OpenAI GPT-4 API
- **Deployment**: Vercel (Frontend) + Firebase (Backend)

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase
Before running the app, you need to add your Firebase App ID to `app.js`:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (task-582ac)
3. Go to Project Settings > General
4. Copy your Web App ID
5. Update the `appId` in `app.js`

### 3. Enable Firebase Services

**Enable Authentication:**
1. In Firebase Console, go to Authentication
2. Click "Get Started"
3. Enable "Email/Password" sign-in method

**Enable Firestore Database:**
1. In Firebase Console, go to Firestore Database
2. Click "Create Database"
3. Start in test mode (or configure security rules)
4. Choose your location

**Firestore Security Rules:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

### 4. Deploy AI Cloud Functions to Firebase

```bash
# Install Firebase Functions dependencies
cd functions
npm install
cd ..

# Deploy to Firebase
firebase deploy --only functions
```

**Note:** The OpenAI API key is securely stored in the Cloud Functions code. Never expose it in frontend code!

### 5. Run Development Server
```bash
npm run dev
```

The app will open at `http://localhost:3000`

### 5. Build for Production
```bash
npm run build
```

## Usage

### Basic Features:
1. **Sign Up**: Create a new account with email and password
2. **Login**: Sign in with your credentials
3. **Add Task**: Fill in the task form and click "Add Task"
4. **Edit Task**: Click "Edit" button on any task to modify it
5. **Delete Task**: Click "Delete" button to remove a task
6. **Logout**: Click logout to sign out

### AI Features:
1. **AI Timeline Prediction**: When creating a task, click "Get AI Suggestion" to receive:
   - Estimated hours needed
   - Complexity level (Low/Medium/High)
   - Recommended number of staff
   - Potential risks

2. **Smart Staff Assignment**: AI recommends the best staff member based on:
   - Current workload
   - Task complexity
   - Availability
   - Prevents staff overload

3. **Strategic Advice**: VIPs can ask business questions and receive:
   - Actionable insights
   - Strategic recommendations
   - Resource optimization tips

## File Structure

```
TASK/
├── index.html          # Main HTML file
├── style.css           # Styles (with AI components)
├── app.js             # Main application logic
├── ai-service.js      # AI integration service
├── vite.config.js     # Vite configuration
├── package.json       # Dependencies
├── firebase.json      # Firebase configuration
├── vercel.json        # Vercel deployment config
├── functions/         # Firebase Cloud Functions
│   ├── index.js       # AI Cloud Functions
│   └── package.json   # Functions dependencies
├── firebaseConfig.js  # Firebase config (backup)
├── .env              # Environment variables
├── .gitignore        # Git ignore rules
└── README.md         # Documentation
```

## AI Cloud Functions

### Available Functions:

1. **`predictTaskTimeline`**
   - Analyzes task details
   - Returns time estimate and complexity
   - Identifies potential risks

2. **`optimizeStaffWorkload`**
   - Analyzes current staff workload
   - Recommends optimal assignment
   - Prevents overload

3. **`getStrategicAdvice`**
   - Provides business insights
   - Strategic recommendations
   - Efficiency suggestions

4. **`testAI`**
   - Tests OpenAI API connection
   - Verifies setup

### Calling AI Functions from Frontend:

```javascript
import { predictTaskTimeline, optimizeStaffAssignment, getStrategicAdvice } from './ai-service.js';

// Predict task timeline
const prediction = await predictTaskTimeline({
  title: 'Build landing page',
  description: 'Create responsive landing page with React',
  projectContext: 'E-commerce website'
});

// Optimize staff assignment
const recommendation = await optimizeStaffAssignment(
  'businessId123',
  newTaskData,
  staffList
);

// Get strategic advice
const advice = await getStrategicAdvice(
  'How can I improve team productivity?',
  businessContext,
  projectsData
);
```

## 💰 Cost Estimation

### OpenAI API (GPT-4):
- ~$0.03 per 1K input tokens
- ~$0.06 per 1K output tokens
- **Estimated**: $50-100/month for small team

### Firebase:
- Authentication: Free up to 10K users
- Firestore: Free up to 50K reads/day
- Functions: Free up to 2M invocations/month

**Total Monthly Cost**: **$50-150** (depending on usage)

## File Structure
The `.env` file containing sensitive credentials is excluded from version control via `.gitignore`.

## Support
For support, email infinitydisigner@gmail.com
