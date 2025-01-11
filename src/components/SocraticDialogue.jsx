import { useState } from 'react';
import '../styles/dialogue.css';

const philosophers = {
  socrates: {
    name: 'Socrates',
    role: 'The Moderator',
    getPrompt: (act) => {
      switch(act) {
        case 1:
          return `As the dialogue moderator, your role is to understand the inquirer's situation deeply. Ask essential, probing questions (max 1-2) that reveal core issues and context. Aim to achieve full clarity in 3-4 exchanges maximum. Keep responses focused and concise (1-2 sentences). Once you have sufficient clarity, indicate you're ready to summarize for the group.`;
        case 2:
          return `For initial summary: Provide a concise overview of ONLY the inquirer's situation and key points from Act 1. Structure your summary with markdown sections (e.g., "**Summary of the Situation:**"). Focus solely on what was discussed with the inquirer - do not include dialogue with other philosophers or pose new questions. Keep it clear and factual.`;
        case 3:
          return `Guide the closing of the dialogue: Request final advice from each philosopher, provide a synthesis of key insights, and close the discussion with a final reflection. Use markdown for formatting key points. Keep the summary concise but comprehensive.`;
        default:
          return '';
      }
    }
  },
  protagoras: {
    name: 'Protagoras',
    role: 'The Behavioural Scientist',
    prompt: `Engage in a natural dialogue about the situation summarized by Socrates. Ask thought-provoking questions, respond to others' points, and offer behavioral insights. Keep responses conversational (1-2 sentences) and build on the ongoing discussion.`
  },
  thales: {
    name: 'Thales',
    role: 'The Logical Thinker',
    prompt: `Participate in the dialogue by offering logical perspectives and responding to others' points. Ask relevant questions and suggest practical approaches. Keep responses conversational (1-2 sentences) and engage with the ongoing discussion.`
  },
  diogenes: {
    name: 'Diogenes',
    role: 'The Cynic Challenger',
    prompt: `Challenge assumptions in the dialogue while engaging with others' points. Ask provocative questions and offer alternative perspectives. Keep responses conversational (1-2 sentences) and maintain a natural flow of discussion.`
  }
};

class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async add(message) {
    this.queue.push(message);
    if (!this.processing) {
      await this.process();
    }
  }

  async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const message = this.queue[0];
      try {
        const response = await this.processMessage(message);
        if (message.onResponse) {
          message.onResponse(response);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
      this.queue.shift();
    }
    this.processing = false;
  }

  async processMessage(message) {
    return await callGPT(message);
  }
}

async function callGPT(message) {
  console.log(`\n=== ${message.philosopher.name}'s View ===`);
  console.log('Context messages:', message.context);
  console.log('Current Act:', message.act);
  
  const philosopherPrompt = message.philosopher.name === 'Socrates' 
    ? message.philosopher.getPrompt(message.act)
    : message.philosopher.prompt;
    
  console.log('System prompt:', philosopherPrompt);
  console.log('User content:', message.content);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          ...message.context,
          { 
            role: 'system', 
            content: philosopherPrompt
          },
          { 
            role: 'user', 
            content: message.content
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling GPT:', error);
    throw error;
  }
}

const messageQueue = new MessageQueue();

export default function SocraticDialogue() {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAct, setCurrentAct] = useState(1);
  const [clarificationCount, setClarificationCount] = useState(0);
  const [dialogueComplete, setDialogueComplete] = useState(false);
  const [summaryProvided, setSummaryProvided] = useState(false);

  const addMessage = (role, content, speaker = null) => {
    // Remove speaker prefix if it exists in content
    let cleanContent = content;
    if (speaker) {
      cleanContent = content.replace(`${speaker}: `, '').replace(`${speaker}:`, '');
    }

    // Apply proper markdown formatting for the message view
    setMessages(prev => [...prev, { 
      role, 
      content: cleanContent, 
      speaker,
      isMarkdown: true  // Add this flag to indicate markdown should be rendered
    }]);
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const handleUserInput = async (input) => {
    if (!input.trim() || dialogueComplete) return;

    setIsProcessing(true);
    setUserInput('');

    let currentContext = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: `${m.speaker}: ${m.content}`
    }));

    try {
      addMessage('user', input, 'Inquirer');

      // Act 1: Socrates clarification phase
      if (currentAct === 1) {
        await handleAct1(input, currentContext);
      }
      // Act 2: Group discussion phase
      else if (currentAct === 2) {
        await handleAct2(input, currentContext);
      }
      // Act 3: Closing phase
      else if (currentAct === 3) {
        await handleAct3(input, currentContext);
      }

    } catch (error) {
      console.error('Error in discourse:', error);
      addMessage('system', 'Our dialogue was interrupted by an error.', 'System');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAct1 = async (input, currentContext) => {
    await messageQueue.add({
      philosopher: philosophers.socrates,
      content: input,
      context: currentContext,
      act: 1,
      onResponse: async (response) => {
        if (response.choices?.[0]?.message?.content) {
          const socratesResponse = response.choices[0].message.content;
          addMessage('assistant', socratesResponse, 'Socrates');
          
          setClarificationCount(prev => {
            const newCount = prev + 1;
            // If we've had enough clarification rounds, move to Act 2
            if (newCount >= 3 || socratesResponse.toLowerCase().includes("ready to summarize")) {
              setCurrentAct(2);
              setSummaryProvided(false);
            }
            return newCount;
          });
        }
      }
    });
  };

  // We'll implement handleAct2 and handleAct3 in the next step
  // For now, these are placeholders
  const handleAct2 = async (input, currentContext) => {
    // If just starting Act 2, do Socrates summary and philosopher introductions
    if (!summaryProvided) {
      // Announce philosophers joining
      const philosopherArray = Object.values(philosophers).filter(p => p.name !== 'Socrates');
      for (const philosopher of philosopherArray) {
        await sleep(1000);
        addMessage('system', `${philosopher.name} joined the chat`, 'System');
      }
      
      await sleep(1000);
      // Get Socrates' summary of Act 1
      await messageQueue.add({
        philosopher: philosophers.socrates,
        content: "Please provide a summary of the discussion so far.",
        context: currentContext,
        act: 2,
        onResponse: async (response) => {
          if (response.choices?.[0]?.message?.content) {
            const summary = response.choices[0].message.content;
            addMessage('assistant', summary, 'Socrates');
            setSummaryProvided(true);
            
            // Add summary to context for other philosophers
            currentContext.push({
              role: 'assistant',
              content: summary
            });

            // Start the first round of discussion
            await continueDiscussion(currentContext, 0);
          }
        }
      });
    } else {
      // Continue with next round
      await continueDiscussion(currentContext, discussionRound);
    }
  };

  // Helper function to manage discussion flow
  const continueDiscussion = async (currentContext, currentRound) => {
    const discussionOrder = [
      philosophers.protagoras,
      philosophers.thales,
      philosophers.diogenes
    ];
    
    // One round of discussion
    for (const philosopher of discussionOrder) {
      await sleep(1500);

      await messageQueue.add({
        philosopher,
        content: currentRound === 0 
          ? "Respond to the philosophical discussion based on the situation Socrates described with your perspective. Don't ask questions." 
          : "Continue the philosophical discussion, building on the previous points. Don't ask questions. Don't repeat your stance, offer insights. Engage in healthy debate from your perspective, and respond to others in the conversation.",
        context: currentContext,
        act: 2,
        onResponse: async (philResponse) => {
          if (philResponse.choices?.[0]?.message?.content) {
            const response = philResponse.choices[0].message.content;
            
            addMessage('assistant', response, philosopher.name);
            currentContext.push({
              role: 'assistant',
              content: response,
              speaker: philosopher.name
            });

            // If this was the last philosopher in the round
            if (philosopher === discussionOrder[discussionOrder.length - 1]) {
              const nextRound = currentRound + 1;
              if (nextRound < 3) {
                await sleep(1500);
                await continueDiscussion(currentContext, nextRound);
              } else {
                setCurrentAct(3);
              }
            }
          }
        }
      });
    }
  };

  const handleAct3 = async (input, currentContext) => {
    // Implementation coming in next step
  };

  return (
    <div className="dialogue-container">
      <div className="message-list">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-header">{msg.speaker}</div>
            <div className="message-content markdown">
              {msg.isMarkdown ? (
                <div dangerouslySetInnerHTML={{ 
                  __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                }} />
              ) : msg.content}
            </div>
          </div>
        ))}
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleUserInput(userInput)}
          placeholder={dialogueComplete ? "Discussion complete" : "Join the dialogue..."}
          disabled={dialogueComplete || isProcessing}
          className="text-input"
        />
        <button
          onClick={() => handleUserInput(userInput)}
          disabled={dialogueComplete || isProcessing}
          className="send-button"
        >
          {isProcessing ? 'Thinking...' : 'Speak'}
        </button>
      </div>
    </div>
  );
}
