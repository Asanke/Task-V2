// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    serverTimestamp 
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA5e-ryWA8_NvnqVpi3xizpGRSDqbIOZEU",
    authDomain: "task-582ac.firebaseapp.com",
    projectId: "task-582ac",
    storageBucket: "task-582ac.firebasestorage.app",
    messagingSenderId: "234394879623",
    appId: "1:234394879623:web:c6bb2684638992100c1a22",
    measurementId: "G-TYQMKVSBRE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutBtn = document.getElementById('logout-btn');
const taskForm = document.getElementById('task-form');
const tasksList = document.getElementById('tasks-list');
const userEmail = document.getElementById('user-email');

let currentUser = null;
let editingTaskId = null;

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showApp();
        userEmail.textContent = user.email;
        loadTasks();
    } else {
        currentUser = null;
        showAuth();
    }
});

// Show/Hide Sections
function showAuth() {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
}

function showApp() {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
}

// Sign Up
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Account created successfully!');
        signupForm.reset();
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Add/Update Task
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const status = document.getElementById('task-status').value;

    const taskData = {
        title,
        description,
        status,
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
    };

    try {
        if (editingTaskId) {
            // Update existing task
            const taskRef = doc(db, 'tasks', editingTaskId);
            await updateDoc(taskRef, taskData);
            alert('Task updated successfully!');
            editingTaskId = null;
            document.getElementById('submit-btn').textContent = 'Add Task';
        } else {
            // Add new task
            taskData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'tasks'), taskData);
            alert('Task added successfully!');
        }
        
        taskForm.reset();
        loadTasks();
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Load Tasks (READ)
async function loadTasks() {
    try {
        const q = query(
            collection(db, 'tasks'),
            where('userId', '==', currentUser.uid),
            orderBy('updatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            tasksList.innerHTML = '<div class="empty-state"><p>No tasks yet. Create your first task!</p></div>';
            return;
        }

        tasksList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const task = doc.data();
            const taskElement = createTaskElement(doc.id, task);
            tasksList.appendChild(taskElement);
        });
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasksList.innerHTML = '<div class="empty-state"><p>Error loading tasks</p></div>';
    }
}

// Create Task Element
function createTaskElement(id, task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = `task-item ${task.status}`;
    
    taskDiv.innerHTML = `
        <div class="task-header">
            <div>
                <div class="task-title">${task.title}</div>
                <span class="task-status status-${task.status}">${task.status}</span>
            </div>
        </div>
        <div class="task-description">${task.description || 'No description'}</div>
        <div class="task-actions">
            <button class="edit-btn" onclick="editTask('${id}', '${task.title}', '${task.description || ''}', '${task.status}')">Edit</button>
            <button class="delete-btn" onclick="deleteTask('${id}')">Delete</button>
        </div>
    `;
    
    return taskDiv;
}

// Edit Task
window.editTask = function(id, title, description, status) {
    editingTaskId = id;
    document.getElementById('task-title').value = title;
    document.getElementById('task-description').value = description;
    document.getElementById('task-status').value = status;
    document.getElementById('submit-btn').textContent = 'Update Task';
    
    // Scroll to form
    document.querySelector('.add-task-form').scrollIntoView({ behavior: 'smooth' });
};

// Delete Task
window.deleteTask = async function(id) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'tasks', id));
        alert('Task deleted successfully!');
        loadTasks();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};
