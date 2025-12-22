import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Minimize2, Maximize2, Bot } from 'lucide-react';

const AICoachChat = ({ exercise, coachCue }) => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: `Hi! I'm your AI Coach. I'll be monitoring your ${exercise} form.` }
  ]);
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef(null);
  const lastCueRef = useRef(coachCue);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Respond to coach cues
  useEffect(() => {
    if (coachCue && coachCue !== lastCueRef.current && coachCue !== 'Get Ready') {
       // Only add message if it's substantial
       // Map specific cues to friendlier chat messages
       let chatText = '';

       if (coachCue.includes('Curl Up')) chatText = "Power up! Squeeze those biceps at the top.";
       else if (coachCue.includes('Lower')) chatText = "Control the weight on the way down. Don't let gravity do the work.";
       else if (coachCue.includes('Squat')) chatText = "Hips back, chest up! Go deep.";
       else if (coachCue.includes('Stand')) chatText = "Drive through your heels to stand up.";
       else if (coachCue.includes('Push Up')) chatText = "Push hard! Keep your core engaged.";
       else if (coachCue.includes('Pull')) chatText = "Drive those elbows down!";
       else chatText = coachCue; // Fallback

       const newMsg = {
           id: Date.now(),
           sender: 'ai',
           text: chatText
       };
       setMessages(prev => [...prev, newMsg]);
       lastCueRef.current = coachCue;
    }
  }, [coachCue]);

  // Random tips effect (optional, every 15s)
  useEffect(() => {
    const interval = setInterval(() => {
        const tips = [
            "Remember to breathe!",
            "Keep your core tight.",
            "Focus on your form, not just the speed.",
            "You're doing great!",
            `Make sure you feel the burn in your ${exercise === 'squat' ? 'legs' : 'arms'}.`
        ];
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: randomTip }]);
    }, 15000);
    return () => clearInterval(interval);
  }, [exercise]);

  if (!isOpen) {
      return (
          <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-4 right-4 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-50"
          >
              <MessageCircle className="w-6 h-6" />
          </button>
      );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 h-96">
      {/* Header */}
      <div className="bg-indigo-600 p-3 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-bold text-sm">AI Coach</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-700 p-1 rounded">
              <Minimize2 className="w-4 h-4" />
          </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-800/95" ref={scrollRef}>
          {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                      msg.sender === 'ai'
                      ? 'bg-gray-700 text-white rounded-tl-none'
                      : 'bg-indigo-600 text-white rounded-tr-none'
                  }`}>
                      {msg.text}
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};

export default AICoachChat;
