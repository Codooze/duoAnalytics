import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, getElementAtEvent } from 'react-chartjs-2';
import { UploadCloud, FileSpreadsheet, XCircle, User, Trash2, BarChart2, GraduationCap, Settings, Info, Moon, Sun } from 'lucide-react';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

// Types
type DuolingoRow = string[];

type ProcessedData = {
  fileId: string;
  name: string;
  username: string;
  className: string;
  date: Date;
  xpTotals: number;
  percentageCompleted: number;
  timeSpentMinutes: number;
  streakDays: number;
  practiceDays: number;
  lessons: number;
  stories: number;
};

type ChartData = {
  labels: string[];
  datasets: any[];
};

type EvaluationWeights = {
  primary: number;
  timeSpentMinutes: number;
  lessons: number;
  stories: number;
  practiceDays: number;
};

// Utilities
const parsePercentage = (val: string) => {
  if (!val) return 0;
  return Number(val.replace(/[^\d.]/g, '')) || 0;
};

const parseTime = (val: string) => {
  if (!val) return 0;
  let minutes = 0;
  const hMatch = val.match(/(\d+)h/);
  const mMatch = val.match(/(\d+)m/);
  if (hMatch) minutes += parseInt(hMatch[1], 10) * 60;
  if (mMatch) minutes += parseInt(mMatch[1], 10);
  return minutes;
};

const CLASS_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.6)', border: 'rgb(59, 130, 246)' },
  { bg: 'rgba(168, 85, 247, 0.6)', border: 'rgb(168, 85, 247)' },
  { bg: 'rgba(16, 185, 129, 0.6)', border: 'rgb(16, 185, 129)' },
  { bg: 'rgba(245, 158, 11, 0.6)', border: 'rgb(245, 158, 11)' },
  { bg: 'rgba(244, 63, 94, 0.6)', border: 'rgb(244, 63, 94)' },
  { bg: 'rgba(6, 182, 212, 0.6)', border: 'rgb(6, 182, 212)' },
  { bg: 'rgba(99, 102, 241, 0.6)', border: 'rgb(99, 102, 241)' },
  { bg: 'rgba(249, 115, 22, 0.6)', border: 'rgb(249, 115, 22)' },
];

export default function AnalyticsDashboard() {
  const [dataPoints, setDataPoints] = useState<ProcessedData[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return newMode;
    });
  };

  const [uploadedFiles, setUploadedFiles] = useState<{id: string, name: string, date: Date}[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [metric, setMetric] = useState<keyof ProcessedData>('xpTotals');
  const [selectedStudent, setSelectedStudent] = useState<ProcessedData | null>(null);

  const [viewMode, setViewMode] = useState<'analytics' | 'evaluation'>('analytics');
  const [showGradingInfo, setShowGradingInfo] = useState<boolean>(false);
  const [maxGrade, setMaxGrade] = useState<number>(5.0);
  const [primaryTarget, setPrimaryTarget] = useState<number>(50000);
  const [metricWeights, setMetricWeights] = useState<EvaluationWeights>({
    primary: 60,
    timeSpentMinutes: 10,
    lessons: 10,
    stories: 10,
    practiceDays: 10
  });

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
    setDataPoints(prev => prev.filter(d => d.fileId !== id));
    if (selectedStudent) setSelectedStudent(null);
  };
  const chartRef = React.useRef<any>(null);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    processFiles(files);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.name.endsWith('.csv'));
      processFiles(files);
    }
  };

  const processFiles = (files: File[]) => {
    setUploadedFiles(prevUploaded => {
      const newFiles = files.filter(f => !prevUploaded.some(pf => pf.id === `${f.name}-${f.lastModified}`));
      if (newFiles.length === 0) return prevUploaded;

      let filesProcessed = 0;
      const newData: ProcessedData[] = [];

      newFiles.forEach((file) => {
        const fileId = `${file.name}-${file.lastModified}`;
        const fileDate = new Date(file.lastModified);
        
        Papa.parse<DuolingoRow>(file, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            // DOCUMENTATION FOR FUTURE DEBUGGING:
            // We use `header: false` and access columns by their fixed array index instead of header names.
            // Duolingo CSV exports maintain a consistent column order across different
            // localized languages (e.g., English vs Spanish). By relying on indexes, 
            // we seamlessly support multi-language exports without maintaining a dictionary of translated headers.
            //
            // Column Index Mapping:
            // [0] Name, [1] Username, [3] Classroom, [5] Streak, [8] % Completed
            // [9] Practice Days, [10] Total XP, [11] Time Spent, [12] Lessons, [13] Stories
            
            // Skip the first row (header) if it matches known header names
            const dataToProcess = results.data.filter(row => row[0] !== 'Nombre completo' && row[0] !== 'Full name' && row[0] !== 'Name');
            dataToProcess.forEach((row) => {
              if (row[0]) {
                newData.push({
                  fileId,
                  name: row[0] || row[1],
                  username: row[1],
                  className: row[3] || 'Unknown',
                  date: fileDate,
                  xpTotals: parseInt(row[10] || '0', 10),
                  percentageCompleted: parsePercentage(row[8]),
                  timeSpentMinutes: parseTime(row[11]),
                  streakDays: parseInt(row[5] || '0', 10),
                  practiceDays: parseInt(row[9] || '0', 10),
                  lessons: parseInt(row[12] || '0', 10),
                  stories: parseInt(row[13] || '0', 10)
                });
              }
            });
            
            filesProcessed++;
            if (filesProcessed === newFiles.length) {
              setDataPoints(prev => [...prev, ...newData]);
            }
          }
        });
      });

      return [...prevUploaded, ...newFiles.map(f => ({
        id: `${f.name}-${f.lastModified}`,
        name: f.name,
        date: new Date(f.lastModified)
      }))];
    });
  };

  const classes = useMemo(() => {
    const list = Array.from(new Set(dataPoints.map(d => d.className)));
    return ['All', ...list.sort()];
  }, [dataPoints]);

  const filteredData = useMemo(() => {
    if (selectedClass === 'All') return dataPoints;
    return dataPoints.filter(d => d.className === selectedClass);
  }, [dataPoints, selectedClass]);

  const latestDataChart = useMemo(() => {
    if (filteredData.length === 0) return null;
    
    // Group by student, get their latest record
    const latestPerStudent = new Map<string, ProcessedData>();
    filteredData.forEach(d => {
      const existing = latestPerStudent.get(d.username);
      if (!existing || existing.date < d.date) {
        latestPerStudent.set(d.username, d);
      }
    });

    const students = Array.from(latestPerStudent.values()).sort((a, b) => 
      (b[metric] as number) - (a[metric] as number)
    );

    const globalClasses = classes.filter(c => c !== 'All');

    return {
      labels: students.map(s => s.name || s.username),
      studentsRef: students, // Need this to access student info on click
      datasets: [
        {
          label: metric === 'xpTotals' ? 'Total XP' : metric === 'percentageCompleted' ? '% Completed' : metric === 'streakDays' ? 'Streak Days' : 'Time Spent (min)',
          data: students.map(s => s[metric]),
          backgroundColor: students.map(s => CLASS_COLORS[globalClasses.indexOf(s.className) % CLASS_COLORS.length]?.bg || CLASS_COLORS[0].bg),
          borderColor: students.map(s => CLASS_COLORS[globalClasses.indexOf(s.className) % CLASS_COLORS.length]?.border || CLASS_COLORS[0].border),
          borderWidth: 1,
        }
      ]
    };
  }, [filteredData, metric, classes]);

  const progressChartData = useMemo(() => {
    if (filteredData.length === 0) return null;

    const activeClasses = Array.from(new Set(filteredData.map(d => d.className))).sort();
    
    const uniqueDatesSet = new Set<number>();
    filteredData.forEach(d => {
      uniqueDatesSet.add(new Date(d.date).setHours(0,0,0,0));
    });
    const sortedDates = Array.from(uniqueDatesSet).sort();

    const byClassAndDate = new Map<string, Map<number, number[]>>();
    activeClasses.forEach(cls => {
      byClassAndDate.set(cls, new Map<number, number[]>());
    });

    filteredData.forEach(d => {
      const time = new Date(d.date).setHours(0,0,0,0);
      const classMap = byClassAndDate.get(d.className)!;
      const arr = classMap.get(time) || [];
      arr.push(d[metric] as number);
      classMap.set(time, arr);
    });

    const globalClasses = classes.filter(c => c !== 'All');

    const datasets = activeClasses.map(cls => {
      const classMap = byClassAndDate.get(cls)!;
      const data = sortedDates.map(date => {
        const arr = classMap.get(date);
        if (!arr || arr.length === 0) return null;
        return arr.reduce((sum, v) => sum + v, 0) / arr.length;
      });

      const colorIndex = globalClasses.indexOf(cls);
      const colorDef = CLASS_COLORS[colorIndex % CLASS_COLORS.length] || CLASS_COLORS[0];

      return {
        label: `${cls}`,
        data,
        borderColor: colorDef.border,
        backgroundColor: colorDef.bg,
        tension: 0.3,
        fill: false,
        spanGaps: true
      };
    });

    return {
      labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
      datasets
    };
  }, [filteredData, metric, classes]);

  const studentProgressChartData = useMemo(() => {
    if (!selectedStudent || dataPoints.length === 0) return null;

    const studentData = dataPoints.filter(d => d.username === selectedStudent.username);
    if (studentData.length <= 1) return null; // Need at least 2 points to draw a progression line

    const sortedData = [...studentData].sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      labels: sortedData.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [
        {
          label: `${selectedStudent.name} - ${metric === 'xpTotals' ? 'XP' : metric === 'percentageCompleted' ? '%' : metric === 'streakDays' ? 'Streak Days' : 'Minutes'}`,
          data: sortedData.map(d => d[metric]),
          borderColor: 'rgb(139, 92, 246)', 
          backgroundColor: 'rgba(139, 92, 246, 0.5)',
          tension: 0.3,
          fill: true
        }
      ]
    };
  }, [dataPoints, selectedStudent, metric]);

  const evaluationResults = useMemo(() => {
    if (viewMode !== 'evaluation' || filteredData.length === 0) return null;

    const latestPerStudent = new Map<string, ProcessedData>();
    filteredData.forEach(d => {
      const existing = latestPerStudent.get(d.username);
      if (!existing || existing.date < d.date) {
        latestPerStudent.set(d.username, d);
      }
    });

    const students = Array.from(latestPerStudent.values());
    if (students.length === 0) return [];

    const getCappedAverage = (key: keyof ProcessedData) => {
      const vals = students.map(s => s[key] as number).sort((a, b) => a - b);
      if (vals.length === 0) return 1;
      // Exclude the top 10% to prevent extreme outliers from skewing the average
      const capIndex = Math.floor(vals.length * 0.9);
      const filteredVals = vals.slice(0, capIndex === 0 ? 1 : capIndex);
      const avg = filteredVals.reduce((sum, val) => sum + val, 0) / filteredVals.length;
      return avg || 1;
    };

    const targetTime = getCappedAverage('timeSpentMinutes');
    const targetLessons = getCappedAverage('lessons');
    const targetStories = getCappedAverage('stories');
    const targetPractice = getCappedAverage('practiceDays');

    const totalWeight = metricWeights.primary + metricWeights.timeSpentMinutes + metricWeights.lessons + metricWeights.stories + metricWeights.practiceDays || 100;

    const results = students.map(student => {
      const primaryMetricValue = Number(student.xpTotals) || 0;
      const primaryScore = Math.min(primaryMetricValue / (primaryTarget || 1), 1) * (metricWeights.primary / totalWeight);
      const timeScore = Math.min(student.timeSpentMinutes / targetTime, 1) * (metricWeights.timeSpentMinutes / totalWeight);
      const lessonsScore = Math.min(student.lessons / targetLessons, 1) * (metricWeights.lessons / totalWeight);
      const storiesScore = Math.min(student.stories / targetStories, 1) * (metricWeights.stories / totalWeight);
      const practiceScore = Math.min(student.practiceDays / targetPractice, 1) * (metricWeights.practiceDays / totalWeight);

      const finalGrade = (primaryScore + timeScore + lessonsScore + storiesScore + practiceScore) * maxGrade;

      return { student, finalGrade, primaryScore, timeScore, lessonsScore, storiesScore, practiceScore };
    });

    return results.sort((a, b) => b.finalGrade - a.finalGrade);
  }, [filteredData, viewMode, primaryTarget, metricWeights, maxGrade]);

  React.useEffect(() => {
    if (viewMode !== 'evaluation' || !selectedStudent || !evaluationResults) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const currentIndex = evaluationResults.findIndex((r: any) => r.student.username === selectedStudent.username);
        if (currentIndex === -1) return;

        e.preventDefault();
        let nextIndex = currentIndex;
        if (e.key === 'ArrowUp' && currentIndex > 0) nextIndex = currentIndex - 1;
        if (e.key === 'ArrowDown' && currentIndex < evaluationResults.length - 1) nextIndex = currentIndex + 1;
        
        if (nextIndex !== currentIndex) {
          setSelectedStudent(evaluationResults[nextIndex].student);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, selectedStudent, evaluationResults]);

  const handleChartClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!chartRef.current || !latestDataChart) return;
    const element = getElementAtEvent(chartRef.current, event);
    if (element.length > 0) {
      const index = element[0].index;
      setSelectedStudent(latestDataChart.studentsRef[index] || null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Duolingo Class Analytics</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Upload student data exports directly from Duolingo to visualize progress</p>
          </div>
          <button 
            onClick={toggleDarkMode}
            className="p-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-6 items-stretch">
            <div 
              onDragOver={(e) => e.preventDefault()} 
              onDrop={onDrop}
              className="flex-1 border-2 border-dashed border-blue-200 rounded-xl p-8 text-center hover:bg-blue-50 transition-colors flex flex-col items-center justify-center max-w-2xl"
            >
              <UploadCloud className="mx-auto h-10 w-10 text-blue-400 mb-3" />
              <p className="text-base text-gray-600 font-medium">Drag & Drop CSV files here</p>
              <p className="text-xs text-gray-400 mt-1 mb-5">Support for multiple files to track historical data</p>
              <label className="cursor-pointer bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
                Browse Files
                <input type="file" multiple accept=".csv" className="hidden" onChange={onFileInput} />
              </label>
            </div>

            <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 overflow-y-auto min-h-[160px] max-h-[220px]">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Class Color Legend</h3>
              <div className="flex flex-wrap gap-2">
                {classes.filter(c => c !== 'All').length > 0 ? (
                  classes.filter(c => c !== 'All').map((className, index) => {
                    const color = CLASS_COLORS[index % CLASS_COLORS.length];
                    return (
                      <div key={className} className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1.5 rounded-full shadow-sm border border-gray-200 dark:border-gray-600">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color.bg, borderColor: color.border, borderWidth: 1 }}></span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{className}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-full w-full">
                    <p className="text-sm text-gray-400 italic">Upload data to see class colors automatically</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {dataPoints.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 col-span-1 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Filters</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Classroom</label>
                    <select 
                      className="w-full bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={selectedClass} 
                      onChange={e => setSelectedClass(e.target.value)}
                    >
                      {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric</label>
                    <select 
                      className="w-full bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={metric} 
                      onChange={e => setMetric(e.target.value as any)}
                    >
                      <option value="xpTotals">Total XP</option>
                      <option value="percentageCompleted">% Completed</option>
                      <option value="timeSpentMinutes">Time Spent (Minutes)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center text-sm mb-4">
                  <span className="text-gray-500 dark:text-gray-400">Total Records:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{dataPoints.length}</span>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-4 mb-4">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Uploaded Files ({uploadedFiles.length})</span>
                    <ul className="space-y-2">
                      {uploadedFiles.map(f => (
                        <li key={f.id} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded-md border border-gray-200 dark:border-gray-600 dark:text-gray-200">
                          <span className="truncate max-w-[160px]" title={f.name}>{f.name}</span>
                          <button onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700 p-1" title="Remove file">
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button 
                  onClick={() => {
                    setDataPoints([]);
                    setUploadedFiles([]);
                    if (selectedStudent) setSelectedStudent(null);
                  }}
                  className="mt-4 flex items-center justify-center w-full gap-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-md transition"
                >
                  <XCircle size={16} /> Clear All Data
                </button>
              </div>
            </div>

            <div className="col-span-1 md:col-span-3 space-y-8">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'analytics' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  <BarChart2 size={16} /> Analytics
                </button>
                <button
                  onClick={() => setViewMode('evaluation')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'evaluation' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  <GraduationCap size={16} /> Evaluation
                </button>
              </div>

              {viewMode === 'analytics' && latestDataChart && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 tracking-tight">Latest Snapshot</h3>
                  <div className="h-[450px]">
                    <Bar 
                      ref={chartRef}
                      onClick={handleChartClick}
                      data={latestDataChart} 
                      options={{ 
                        maintainAspectRatio: false,
                        plugins: { 
                          legend: { display: false },
                          datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            textAlign: 'center',
                            color: isDarkMode ? '#e5e7eb' : '#6b7280',
                            formatter: (value, context) => {
                              const student = latestDataChart.studentsRef[context.dataIndex];
                              return student.streakDays ? ['🔥', `${student.streakDays}`] : '';
                            },
                            font: { weight: 'bold' }
                          }
                        },
                        scales: { 
                          y: { 
                            beginAtZero: true, 
                            grace: '10%',
                            ticks: { color: isDarkMode ? '#e5e7eb' : '#6b7280' },
                            grid: { color: isDarkMode ? '#374151' : '#f3f4f6' }
                          },
                          x: { 
                            ticks: { 
                              autoSkip: false,
                              maxRotation: 45,
                              minRotation: 45,
                              color: isDarkMode ? '#e5e7eb' : '#6b7280'
                            },
                            grid: { color: isDarkMode ? '#374151' : '#f3f4f6' }
                          }
                        },
                        interaction: { mode: 'index', intersect: true },
                        layout: { padding: { top: 30 } }
                      }} 
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-2">Click on any bar to see detailed student statistics</p>
                </div>
              )}

              {viewMode === 'evaluation' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {selectedClass === 'All' && classes.length > 2 ? (
                    <div className="bg-white dark:bg-gray-800 p-12 text-center rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center">
                      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-full mb-4">
                        <GraduationCap className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Select a specific class</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">The evaluation view requires filtering to a single classroom to accurately calculate and curve class grading scales.</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-6">
                          <Settings className="text-blue-500 dark:text-blue-400 h-5 w-5" />
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Grading Configuration</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Max Grade</label>
                            <input type="number" step="0.1" value={maxGrade} onChange={e => setMaxGrade(Number(e.target.value))} className="w-full text-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Main Target (XP)</label>
                            <input type="number" value={primaryTarget} onChange={e => setPrimaryTarget(Number(e.target.value))} className="w-full text-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md shadow-sm p-2 border focus:ring-blue-500 outline-none" />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Metric Weights (%) - Auto Curves to Class Average</h4>
                          <div className="grid grid-cols-2 text-sm gap-4 items-center">
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                              <span className="font-medium text-gray-600 dark:text-gray-300">Main Metric</span>
                              <input type="number" value={metricWeights.primary} onChange={e => setMetricWeights({...metricWeights, primary: Number(e.target.value)})} className="w-16 p-1 border rounded text-center bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
                            </div>
                            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/30 p-2 rounded border border-purple-100 dark:border-purple-800">
                              <span className="font-medium text-purple-700 dark:text-purple-400">Time</span>
                              <input type="number" value={metricWeights.timeSpentMinutes} onChange={e => setMetricWeights({...metricWeights, timeSpentMinutes: Number(e.target.value)})} className="w-16 p-1 border rounded text-center bg-white dark:bg-purple-950 border-purple-200 dark:border-purple-700 text-purple-900 dark:text-purple-100" />
                            </div>
                            <div className="flex items-center justify-between bg-pink-50 dark:bg-pink-900/30 p-2 rounded border border-pink-100 dark:border-pink-800">
                              <span className="font-medium text-pink-700 dark:text-pink-400">Lessons</span>
                              <input type="number" value={metricWeights.lessons} onChange={e => setMetricWeights({...metricWeights, lessons: Number(e.target.value)})} className="w-16 p-1 border rounded text-center bg-white dark:bg-pink-950 border-pink-200 dark:border-pink-700 text-pink-900 dark:text-pink-100" />
                            </div>
                            <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded border border-yellow-100 dark:border-yellow-800">
                              <span className="font-medium text-yellow-700 dark:text-yellow-500">Stories</span>
                              <input type="number" value={metricWeights.stories} onChange={e => setMetricWeights({...metricWeights, stories: Number(e.target.value)})} className="w-16 p-1 border rounded text-center bg-white dark:bg-yellow-950 border-yellow-200 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100" />
                            </div>
                            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/30 p-2 rounded border border-orange-100 dark:border-orange-800">
                              <span className="font-medium text-orange-700 dark:text-orange-400">Practice Days</span>
                              <input type="number" value={metricWeights.practiceDays} onChange={e => setMetricWeights({...metricWeights, practiceDays: Number(e.target.value)})} className="w-16 p-1 border rounded text-center bg-white dark:bg-orange-950 border-orange-200 dark:border-orange-700 text-orange-900 dark:text-orange-100" />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => setShowGradingInfo(true)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-full transition-colors"
                            >
                              <Info className="h-4 w-4" />
                              How Grading Works
                            </button>
                            <span className={`text-xs font-semibold ${Object.values(metricWeights).reduce((a,b)=>a+b,0) === 100 ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>
                              Total Weight: {Object.values(metricWeights).reduce((a,b)=>a+b,0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Roster Evaluation</h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">T/↓ to navigate</span>
                        </div>
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                          {evaluationResults?.map((res: any, idx: number) => {
                            const isSelected = selectedStudent?.username === res.student.username;
                            const gradeColor = res.finalGrade >= maxGrade * 0.9 ? 'text-green-600 dark:text-green-500' : res.finalGrade >= maxGrade * 0.7 ? 'text-blue-600 dark:text-blue-400' : res.finalGrade >= maxGrade * 0.5 ? 'text-orange-500 dark:text-orange-400' : 'text-red-600 dark:text-red-500';
                            
                            return (
                              <li 
                                key={res.student.username}
                                onClick={() => setSelectedStudent(res.student)}
                                className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'}`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="text-sm font-semibold text-gray-400 dark:text-gray-500 w-6">{idx + 1}.</div>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-200">{res.student.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">@{res.student.username}</div>
                                  </div>
                                </div>
                                <div className={`text-xl font-bold ${gradeColor}`}>
                                  {res.finalGrade.toFixed(2)}<span className="text-gray-400 dark:text-gray-500 text-sm font-medium">/{maxGrade.toFixed(1)}</span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedStudent && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-full shrink-0">
                    <User className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedStudent.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{selectedStudent.username} • {selectedStudent.className}</p>
                      </div>
                      <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                        <XCircle size={20} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-y-4 gap-x-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Total XP</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedStudent.xpTotals.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Course %</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedStudent.percentageCompleted}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Time Spent</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {Math.floor(selectedStudent.timeSpentMinutes / 60)}h {selectedStudent.timeSpentMinutes % 60}m
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Practice Days</p>
                        <p className="text-2xl font-bold text-orange-500 dark:text-orange-400">{selectedStudent.practiceDays}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Lessons</p>
                        <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">{selectedStudent.lessons}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Stories</p>
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{selectedStudent.stories}</p>
                      </div>
                    </div>

                    {studentProgressChartData && (
                      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 tracking-tight">Individual Progression</h5>
                        <div className="h-48">
                          <Line 
                            data={studentProgressChartData}
                            options={{ 
                              maintainAspectRatio: false,
                              scales: { 
                                y: { 
                                  beginAtZero: true,
                                  ticks: { color: isDarkMode ? '#e5e7eb' : '#6b7280' },
                                  grid: { color: isDarkMode ? '#374151' : '#f3f4f6' }
                                },
                                x: { 
                                  ticks: { color: isDarkMode ? '#e5e7eb' : '#6b7280' },
                                  grid: { color: isDarkMode ? '#374151' : '#f3f4f6' }
                                }
                              },
                              plugins: { 
                                legend: { display: false },
                                datalabels: { display: false }
                              }
                            }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewMode === 'analytics' && progressChartData && progressChartData.labels.length > 1 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 tracking-tight">Class Progression Over Time</h3>
                  <div className="h-80">
                    <Line 
                      data={progressChartData}
                      options={{ 
                        maintainAspectRatio: false,
                        scales: { 
                          y: { 
                            beginAtZero: true,
                            ticks: { color: isDarkMode ? '#e5e7eb' : '#6b7280' },
                            grid: { color: isDarkMode ? '#374151' : '#f3f4f6' }
                          },
                          x: { 
                            ticks: { color: isDarkMode ? '#e5e7eb' : '#6b7280' },
                            grid: { color: isDarkMode ? '#374151' : '#f3f4f6' }
                          }
                        },
                        plugins: { datalabels: { display: false } }
                      }} 
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-4 text-center">Dates automatically derived from file upload metadata.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-2 right-3 text-[10px] text-gray-300 hover:text-gray-500 transition-colors duration-500 flex items-center group cursor-default z-40 select-none">
        <span>&copy; {new Date().getFullYear()} All rights reserved. By:&nbsp;</span>
        <span className="font-semibold">J</span>
        <span className="max-w-0 overflow-hidden group-hover:max-w-[40px] transition-all duration-500 ease-in-out whitespace-nowrap">eison&nbsp;</span>
        <span className="font-semibold">M</span>
        <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-500 ease-in-out whitespace-nowrap">artinez</span>
      </div>

      {showGradingInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-blue-50 dark:bg-blue-900/30 rounded-t-xl">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">How Grading Works</h2>
              </div>
              <button 
                onClick={() => setShowGradingInfo(false)} 
                className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors p-1"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base">
              
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-sm">1</span>
                  Main Target
                </h4>
                <p>The "Main Target" is the explicit goal you define (e.g. 50,000 XP) required for a student to earn 100% of the primary weight bracket.</p>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded text-sm">2</span>
                  Class Average Curve (Outlier Rejection)
                </h4>
                <p className="mb-3">
                  Instead of forcing you to guess how many lessons, stories, or hours a student <em>should</em> have completed, the system calculates targets automatically based on the class's average performance.
                </p>
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 rounded-lg relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-400 dark:bg-purple-500"></div>
                  <p className="italic text-gray-600 dark:text-gray-400">
                    <strong>Think of it this way:</strong> The system takes everyone's scores and calculates the classroom average, but it <strong>excludes the top 10% of overachievers</strong> before doing the math.
                  </p>
                  <p className="italic text-gray-600 dark:text-gray-400 mt-3">
                    This sets a fair "average student" target. It ensures the goal is realistic based on the majority of the class, and prevents extreme outliers (like a student who practiced 10x more than everyone else) from unfairly inflating the average and ruining the curve for everyone else.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded text-sm">3</span>
                  Recommendations
                </h4>
                <p>
                  It's highly recommended to keep the Primary Metric weight at <strong>60% or higher</strong>. This prevents a loophole where a student with very low XP gets a passing grade just because they happened to match the class averages in secondary metrics like time spent.
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
                <button 
                  onClick={() => setShowGradingInfo(false)} 
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
