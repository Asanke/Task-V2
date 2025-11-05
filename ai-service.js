// AI Service - Frontend integration with Firebase Cloud Functions
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './app.js';

const functions = getFunctions(app);

/**
 * Test AI Connection
 */
export async function testAIConnection() {
  const testFunction = httpsCallable(functions, 'testAI');
  
  try {
    const result = await testFunction({});
    console.log('AI Test Result:', result.data);
    return result.data;
  } catch (error) {
    console.error('AI Test Failed:', error);
    throw error;
  }
}

/**
 * Predict Task Timeline using AI
 * @param {Object} taskData - Task information
 * @returns {Promise<Object>} AI prediction with timeline and complexity
 */
export async function predictTaskTimeline(taskData) {
  const predictFunction = httpsCallable(functions, 'predictTaskTimeline');
  
  try {
    const result = await predictFunction({
      taskTitle: taskData.title,
      taskDescription: taskData.description || '',
      projectContext: taskData.projectContext || 'General task'
    });
    
    return result.data;
  } catch (error) {
    console.error('AI Timeline Prediction Error:', error);
    throw error;
  }
}

/**
 * Optimize Staff Assignment using AI
 * @param {string} businessId - Business ID
 * @param {Object} newTask - New task to assign
 * @param {Array} staffList - List of available staff
 * @returns {Promise<Object>} AI recommendation for staff assignment
 */
export async function optimizeStaffAssignment(businessId, newTask, staffList) {
  const optimizeFunction = httpsCallable(functions, 'optimizeStaffWorkload');
  
  try {
    const result = await optimizeFunction({
      businessId,
      newTask,
      staffList
    });
    
    return result.data;
  } catch (error) {
    console.error('Staff Optimization Error:', error);
    throw error;
  }
}

/**
 * Get Strategic Business Advice from AI
 * @param {string} question - VIP's question
 * @param {Object} businessContext - Current business context
 * @param {Array} projectsData - Active projects data
 * @returns {Promise<Object>} AI strategic advice
 */
export async function getStrategicAdvice(question, businessContext, projectsData) {
  const adviceFunction = httpsCallable(functions, 'getStrategicAdvice');
  
  try {
    const result = await adviceFunction({
      question,
      businessContext: businessContext || {},
      projectsData: projectsData || []
    });
    
    return result.data;
  } catch (error) {
    console.error('Strategic Advice Error:', error);
    throw error;
  }
}

/**
 * Display AI Loading State
 */
export function showAILoading(message = 'AI is analyzing...') {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'ai-loading';
  loadingDiv.className = 'ai-loading';
  loadingDiv.innerHTML = `
    <div class="ai-loading-content">
      <div class="ai-spinner"></div>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(loadingDiv);
}

/**
 * Hide AI Loading State
 */
export function hideAILoading() {
  const loadingDiv = document.getElementById('ai-loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}

/**
 * Display AI Suggestion Modal
 */
export function displayAISuggestion(prediction, onApprove, onReject) {
  hideAILoading();
  
  const modal = document.createElement('div');
  modal.id = 'ai-suggestion-modal';
  modal.className = 'ai-modal';
  
  let predictionHTML = '';
  if (typeof prediction === 'object' && !prediction.rawResponse) {
    predictionHTML = `
      <div class="ai-prediction">
        <h3>🤖 AI Timeline Prediction</h3>
        <div class="prediction-details">
          <p><strong>Estimated Hours:</strong> ${prediction.estimatedHours || 'N/A'} hours</p>
          <p><strong>Complexity:</strong> <span class="complexity-${prediction.complexityLevel}">${prediction.complexityLevel || 'medium'}</span></p>
          <p><strong>Recommended Staff:</strong> ${prediction.recommendedStaff || 1} person(s)</p>
          ${prediction.breakdown ? `<p><strong>Breakdown:</strong> ${prediction.breakdown}</p>` : ''}
          ${prediction.risks && prediction.risks.length > 0 ? `
            <div class="risks">
              <strong>Potential Risks:</strong>
              <ul>
                ${prediction.risks.map(risk => `<li>${risk}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else {
    predictionHTML = `
      <div class="ai-prediction">
        <h3>🤖 AI Suggestion</h3>
        <p>${prediction.rawResponse || prediction}</p>
      </div>
    `;
  }
  
  modal.innerHTML = `
    <div class="ai-modal-content">
      ${predictionHTML}
      <div class="ai-modal-actions">
        <button id="ai-approve" class="ai-btn-approve">✓ Approve & Create Task</button>
        <button id="ai-adjust" class="ai-btn-adjust">✎ Adjust Timeline</button>
        <button id="ai-reject" class="ai-btn-reject">✗ Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event listeners
  document.getElementById('ai-approve').onclick = () => {
    modal.remove();
    if (onApprove) onApprove(prediction);
  };
  
  document.getElementById('ai-adjust').onclick = () => {
    modal.remove();
    if (onApprove) onApprove(prediction, true); // true = allow adjustment
  };
  
  document.getElementById('ai-reject').onclick = () => {
    modal.remove();
    if (onReject) onReject();
  };
}
