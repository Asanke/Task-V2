const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Import calendar composers
const calendarComposers = require('./calendar-composers');

// Export calendar functions
exports.calendarComposeMy = calendarComposers.calendarComposeMy;
exports.calendarComposeTeam = calendarComposers.calendarComposeTeam;
exports.calendarComposeProject = calendarComposers.calendarComposeProject;
exports.availabilityRecomputeDaily = calendarComposers.availabilityRecomputeDaily;

// OpenAI API Key - Get from environment variable or Firebase config
// For production, use: firebase functions:config:set openai.key="YOUR_KEY"
const OPENAI_API_KEY = functions.config().openai?.key || process.env.OPENAI_API_KEY;

/**
 * AI Task Timeline Prediction
 * Analyzes task details and predicts realistic timeline
 */
exports.predictTaskTimeline = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
    );
  }

  const {taskTitle, taskDescription, projectContext} = data;

  if (!taskTitle) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Task title is required"
    );
  }

  try {
    // Call OpenAI API
    const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `You are a professional task management AI assistant. 
                Analyze tasks and provide realistic timeline estimates based on 
                complexity, scope, and industry standards. Respond in JSON format.`,
              },
              {
                role: "user",
                content: `Task: ${taskTitle}
Description: ${taskDescription || "No description provided"}
Project Context: ${projectContext || "General task"}

Provide a JSON response with:
{
  "estimatedHours": number,
  "complexityLevel": "low" | "medium" | "high",
  "recommendedStaff": number,
  "breakdown": "brief explanation",
  "risks": ["potential risk 1", "potential risk 2"]
}`,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API Error:", error);
      throw new Error(`OpenAI API failed: ${response.status}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;

    // Parse JSON response
    let prediction;
    try {
      prediction = JSON.parse(aiResponse);
    } catch (e) {
      // If not valid JSON, return raw text
      prediction = {
        rawResponse: aiResponse,
        estimatedHours: 8,
        complexityLevel: "medium",
      };
    }

    // Log prediction for learning
    await admin.firestore().collection("aiPredictions").add({
      userId: context.auth.uid,
      taskTitle,
      taskDescription,
      prediction,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      model: "gpt-4",
    });

    return {
      success: true,
      prediction,
    };
  } catch (error) {
    console.error("AI Prediction Error:", error);
    throw new functions.https.HttpsError(
        "internal",
        `Failed to generate prediction: ${error.message}`
    );
  }
});

/**
 * AI Staff Workload Optimizer
 * Recommends best staff member for task assignment
 */
exports.optimizeStaffWorkload = functions.https.onCall(
    async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be authenticated"
        );
      }

      const {businessId, newTask, staffList} = data;

      if (!businessId || !newTask) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Business ID and task details required"
        );
      }

      try {
        // Get current tasks for all staff
        const tasksSnapshot = await admin
            .firestore()
            .collection("tasks")
            .where("businessId", "==", businessId)
            .where("status", "in", ["pending", "in-progress"])
            .get();

        const workloadData = {};
        tasksSnapshot.forEach((doc) => {
          const task = doc.data();
          if (task.assignedTo) {
            if (!workloadData[task.assignedTo]) {
              workloadData[task.assignedTo] = [];
            }
            workloadData[task.assignedTo].push({
              title: task.title,
              status: task.status,
              priority: task.priority,
            });
          }
        });

        // Call OpenAI for optimization
        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: "gpt-4",
                messages: [
                  {
                    role: "system",
                    content: `You are a workload optimization AI. Analyze staff 
                    workloads and recommend fair task assignments. Prevent 
                    overload and balance work distribution.`,
                  },
                  {
                    role: "user",
                    content: `Current Staff Workload:
${JSON.stringify(workloadData, null, 2)}

Staff List:
${JSON.stringify(staffList, null, 2)}

New Task:
${JSON.stringify(newTask, null, 2)}

Provide JSON response:
{
  "recommendedStaff": "staffId",
  "reason": "explanation",
  "workloadScore": number (0-100),
  "alternatives": ["staffId2", "staffId3"],
  "warning": "optional warning if overload detected"
}`,
                  },
                ],
                temperature: 0.5,
                max_tokens: 400,
              }),
            }
        );

        const result = await response.json();
        const aiResponse = result.choices[0].message.content;

        let recommendation;
        try {
          recommendation = JSON.parse(aiResponse);
        } catch (e) {
          recommendation = {rawResponse: aiResponse};
        }

        return {
          success: true,
          recommendation,
          currentWorkload: workloadData,
        };
      } catch (error) {
        console.error("Workload Optimization Error:", error);
        throw new functions.https.HttpsError(
            "internal",
            `Failed to optimize workload: ${error.message}`
        );
      }
    }
);

/**
 * AI Strategic Advice for VIPs
 * Provides business insights and recommendations
 */
exports.getStrategicAdvice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
    );
  }

  const {question, businessContext, projectsData} = data;

  if (!question) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Question is required"
    );
  }

  try {
    const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `You are a strategic business advisor AI for VIP 
                business owners. Provide insightful, actionable advice focused 
                on efficiency, delegation, and strategic growth. Consider 
                work-life balance and time management.`,
              },
              {
                role: "user",
                content: `Business Context:
${JSON.stringify(businessContext, null, 2)}

Active Projects:
${JSON.stringify(projectsData, null, 2)}

VIP Question: ${question}

Provide strategic advice in a clear, actionable format.`,
              },
            ],
            temperature: 0.8,
            max_tokens: 800,
          }),
        }
    );

    const result = await response.json();
    const advice = result.choices[0].message.content;

    // Log for learning
    await admin.firestore().collection("aiAdvice").add({
      userId: context.auth.uid,
      question,
      advice,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      advice,
    };
  } catch (error) {
    console.error("Strategic Advice Error:", error);
    throw new functions.https.HttpsError(
        "internal",
        `Failed to generate advice: ${error.message}`
    );
  }
});

/**
 * Test function to verify AI setup
 */
exports.testAI = functions.https.onCall(async (data, context) => {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API test failed: ${response.status}`);
    }

    const models = await response.json();

    return {
      success: true,
      message: "OpenAI API is working!",
      availableModels: models.data.slice(0, 5).map((m) => m.id),
    };
  } catch (error) {
    console.error("AI Test Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
});
