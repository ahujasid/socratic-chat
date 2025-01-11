
import { useState } from 'react';
import '../styles/dialogue.css';

const philosophers = {
  socrates: {
    name: 'Socrates',
    role: 'The Orchestrator',
    prompt: `Directly engage with the most recent thoughts shared in the conversation. Ask probing questions that explore motivations, consequences, and reasoning behind the user's statements. Avoid abstract philosophical discussions unrelated to the topic. Never repeat or ask for clarification. Always build on the existing dialogue. Keep responses to 1-2 sentences. Only advice once you have enough clarity.`
  },
  protagoras: {
    name: 'Protagoras',
    role: 'The Behavioural Scientist',
    prompt: `Analyze the latest points raised in the conversation, focusing on the user's specific situation or topic. Provide behavioural insights and point out biases could influence the discussion. Avoid abstract discussions and keep responses to 1-2 sentences. Only advice once you have enough clarity.`
  },
  thales: {
    name: 'Thales',
    role: 'The Logical Thinker',
    prompt: `Break down the user's situation or topic into logical components. Engage with previous statements by offering fundamental reasoning specific to the discussion at hand. Avoid abstract philosophical topics and keep responses to 1-2 sentences. Only advice once you have enough clarity.`
  },
  diogenes: {
    name: 'Diogenes',
    role: 'The Cynic Challenger',
    prompt: `Directly challenge assumptions in the ongoing discussion with wit and critique. Expose any contradictions and biases related to the specific situation or topic. Avoid abstract philosophical discussions and keep responses to 1-2 sentences. Only advice once you have enough clarity.`
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
    const response = await callGPT(message);
    return response;
  }
}

async function callGPT(message) {
  console.log(`\n=== ${message.philosopher.name}'s View ===`);
  console.log('Context messages:', message.context);
  console.log('System prompt:', message.philosopher.prompt);
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
          // ⬇️ Pass the conversation context first
          ...message.context,
          { 
            role: 'system', 
            content: message.philosopher.prompt  // Philosopher prompt comes after context
          },
          { 
            role: 'user', 
            content: message.content  // User's latest input
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
  const [conversationHistory, setConversationHistory] = useState([]);


  const getRecentDiscussion = () => {
    
    console.log('\n=== getRecentDiscussion called ===');
  console.log('Current messages state:', messages);
    return messages.slice(-5).map(m => ({
      role: m.role,
      content: `${m.speaker}: ${m.content}`
    }));
  };
  

  const addMessage = (role, content, speaker = null) => {
    console.log('\n=== addMessage called ===');
  console.log('Adding message:', { role, content, speaker });
  console.log('Current messages before add:', messages);
    setMessages(prev => [...prev, { role, content, speaker }]);
  };

  // Add this helper function
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Modify the message processing in handleUserInput
const handleUserInput = async (input) => {
  if (!input.trim()) return;

  setIsProcessing(true);
  setUserInput('');
  setConversationHistory(prev => [...prev, input]);

  // Create initial context with user's message
  let currentContext = [{
    role: 'user',
    content: `Inquirer: ${input}`
  }];

  try {
    addMessage('user', input, 'Inquirer');

    await messageQueue.add({
      philosopher: philosophers.socrates,
      content: input,
      context: currentContext,
      onResponse: async (response) => {
        if (response.choices?.[0]?.message?.content) {
          const socratesResponse = response.choices[0].message.content;
          addMessage('assistant', socratesResponse, 'Socrates');
          currentContext.push({
            role: 'assistant',
            content: `Socrates: ${socratesResponse}`
          });

          // Keep the original round-based dialogue flow
          const continueDialogue = async (roundNumber = 1) => {
            const philosopherArray = Object.values(philosophers).filter(p => p.name !== 'Socrates');

            for (const philosopher of philosopherArray) {
              await sleep(3500);
              await messageQueue.add({
                philosopher,
                content: input,
                context: currentContext,
                onResponse: (philResponse) => {
                  if (philResponse.choices?.[0]?.message?.content) {
                    const response = philResponse.choices[0].message.content;
                    addMessage('assistant', response, philosopher.name);
                    currentContext.push({
                      role: 'assistant',
                      content: `${philosopher.name}: ${response}`
                    });
                  }
                }
              });
            }

            // Socrates steers the dialogue forward
            await sleep(2000);
            await messageQueue.add({
              philosopher: philosophers.socrates,
              content: input,
              context: currentContext,
              onResponse: async (socratesResponse) => {
                if (socratesResponse.choices?.[0]?.message?.content) {
                  const response = socratesResponse.choices[0].message.content;
                  addMessage('assistant', response, 'Socrates');
                  currentContext.push({
                    role: 'assistant',
                    content: `Socrates: ${response}`
                  });

                  // Continue dialogue for 3 rounds
                  if (roundNumber < 2) {
                    continueDialogue(roundNumber + 1);
                  }
                }
              }
            });
          };

          // Start the ongoing multi-round dialogue
          continueDialogue();
        }
      }
    });
  } catch (error) {
    console.error('Error in discourse:', error);
    addMessage('system', 'Our dialogue was interrupted by an error.', 'System');
  } finally {
    setIsProcessing(false);
  }
};


  return (
    <div className="dialogue-container">
      <div className="message-list">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`message ${msg.role}`}
          >
            <div className="message-header">{msg.speaker}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleUserInput(userInput)}
          placeholder="Join the dialogue..."
          className="text-input"
        />
        <button
          onClick={() => handleUserInput(userInput)}
          className="send-button"
        >
          {isProcessing ? 'Thinking...' : 'Speak'}
        </button>
      </div>
    </div>
  );
}