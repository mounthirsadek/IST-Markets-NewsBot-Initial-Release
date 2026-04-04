import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

interface Story {
  id: string;
  headline: string;
  status: string;
  scheduledAt?: any;
  createdAt: any;
  theme: string;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'stories'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Story)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getStoriesForDay = (day: Date) => {
    return stories.filter(story => {
      const storyDate = story.scheduledAt?.toDate() || story.createdAt?.toDate();
      return storyDate && isSameDay(storyDate, day);
    });
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter">Content Calendar</h2>
          <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Schedule & Publication Timeline</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/10">
          <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-bold min-w-[150px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      <div className="glass rounded-2xl border-white/5 overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-white/10 bg-white/5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-4 text-center text-[10px] uppercase tracking-widest text-white/40 font-bold">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 auto-rows-[150px]">
          {calendarDays.map((day, idx) => {
            const dayStories = getStoriesForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toString()} 
                className={`p-2 border-r border-b border-white/5 relative group transition-colors ${
                  !isCurrentMonth ? 'opacity-20' : 'hover:bg-white/[0.02]'
                }`}
              >
                <span className={`text-xs font-mono mb-2 inline-block px-2 py-1 rounded-md ${
                  isToday ? 'bg-[#f27d26] text-black font-bold' : 'text-white/40'
                }`}>
                  {format(day, 'd')}
                </span>

                <div className="space-y-1 overflow-y-auto max-h-[100px] scrollbar-hide">
                  {dayStories.map(story => (
                    <Link 
                      key={story.id}
                      to={`/publish/${story.id}`}
                      className={`block p-1.5 rounded text-[10px] truncate border transition-all ${
                        story.status === 'published' 
                          ? 'bg-green-400/10 border-green-400/20 text-green-400' 
                          : story.status === 'scheduled'
                          ? 'bg-blue-400/10 border-blue-400/20 text-blue-400'
                          : 'bg-white/5 border-white/10 text-white/60'
                      } hover:scale-[1.02]`}
                    >
                      <div className="flex items-center gap-1">
                        {story.status === 'published' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        <span className="truncate">{story.headline}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 p-4 glass rounded-xl border-white/5 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-400/20 border border-green-400/40" />
          <span className="text-[10px] uppercase tracking-widest text-white/40">Published</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-400/20 border border-blue-400/40" />
          <span className="text-[10px] uppercase tracking-widest text-white/40">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-white/5 border border-white/10" />
          <span className="text-[10px] uppercase tracking-widest text-white/40">Draft</span>
        </div>
      </div>
    </div>
  );
}
