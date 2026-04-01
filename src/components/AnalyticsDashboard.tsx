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
import { UploadCloud, FileSpreadsheet, XCircle, User, Trash2 } from 'lucide-react';
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
type DuolingoRow = {
  'Nombre completo': string;
  Usuario: string;
  Correo: string;
  'Salón de clases': string;
  Idioma: string;
  'Días de racha': string;
  'Secciones completadas': string;
  'Porcentaje completado': string;
  'EXP totales': string;
  'Tiempo dedicado a aprender': string;
  [key: string]: string;
};

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
  const [uploadedFiles, setUploadedFiles] = useState<{id: string, name: string, date: Date}[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [metric, setMetric] = useState<keyof ProcessedData>('xpTotals');
  const [selectedStudent, setSelectedStudent] = useState<ProcessedData | null>(null);
  
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
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            results.data.forEach((row) => {
              if (row['Nombre completo']) {
                newData.push({
                  fileId,
                  name: row['Nombre completo'] || row.Usuario,
                  username: row.Usuario,
                  className: row['Salón de clases'] || 'Unknown',
                  date: fileDate,
                  xpTotals: parseInt(row['EXP totales'] || '0', 10),
                  percentageCompleted: parsePercentage(row['Porcentaje completado']),
                  timeSpentMinutes: parseTime(row['Tiempo dedicado a aprender']),
                  streakDays: parseInt(row['Días de racha'] || '0', 10),
                  practiceDays: parseInt(row['Días de práctica'] || '0', 10),
                  lessons: parseInt(row['Lecciones'] || '0', 10),
                  stories: parseInt(row['Cuentos'] || '0', 10)
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

    // Group by date, average metric
    const byDate = new Map<number, number[]>();
    filteredData.forEach(d => {
      const time = new Date(d.date).setHours(0,0,0,0);
      const arr = byDate.get(time) || [];
      arr.push(d[metric] as number);
      byDate.set(time, arr);
    });

    const sortedDates = Array.from(byDate.keys()).sort();
    const averages = sortedDates.map(date => {
      const arr = byDate.get(date)!;
      return arr.reduce((sum, v) => sum + v, 0) / arr.length;
    });

    return {
      labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
      datasets: [
        {
          label: `Class Average - ${metric === 'xpTotals' ? 'XP' : metric === 'percentageCompleted' ? '%' : metric === 'streakDays' ? 'Streak Days' : 'Minutes'}`,
          data: averages,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          tension: 0.3,
          fill: true
        }
      ]
    };
  }, [filteredData, metric]);

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

  const handleChartClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!chartRef.current || !latestDataChart) return;
    const element = getElementAtEvent(chartRef.current, event);
    if (element.length > 0) {
      const index = element[0].index;
      setSelectedStudent(latestDataChart.studentsRef[index] || null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Duolingo Class Analytics</h1>
          <p className="text-gray-500 mt-2">Upload student data exports directly from Duolingo to visualize progress</p>
        </header>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

            <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-6 overflow-y-auto min-h-[160px] max-h-[220px]">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Class Color Legend</h3>
              <div className="flex flex-wrap gap-2">
                {classes.filter(c => c !== 'All').length > 0 ? (
                  classes.filter(c => c !== 'All').map((className, index) => {
                    const color = CLASS_COLORS[index % CLASS_COLORS.length];
                    return (
                      <div key={className} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color.bg, borderColor: color.border, borderWidth: 1 }}></span>
                        <span className="text-sm font-medium text-gray-700">{className}</span>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Filters</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Classroom</label>
                    <select 
                      className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={selectedClass} 
                      onChange={e => setSelectedClass(e.target.value)}
                    >
                      {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metric</label>
                    <select 
                      className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500 outline-none"
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

              <div className="pt-6 border-t border-gray-100">
                <div className="flex justify-between items-center text-sm mb-4">
                  <span className="text-gray-500">Total Records:</span>
                  <span className="font-semibold text-gray-900">{dataPoints.length}</span>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-4 mb-4">
                    <span className="text-sm font-semibold text-gray-700">Uploaded Files ({uploadedFiles.length})</span>
                    <ul className="space-y-2">
                      {uploadedFiles.map(f => (
                        <li key={f.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded-md border border-gray-200">
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
              {latestDataChart && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 tracking-tight">Latest Snapshot</h3>
                  <div className="h-80">
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
                            formatter: (value, context) => {
                              const student = latestDataChart.studentsRef[context.dataIndex];
                              return student.streakDays ? ['🔥', `${student.streakDays}`] : '';
                            },
                            font: { weight: 'bold' }
                          }
                        },
                        scales: { y: { beginAtZero: true } },
                        interaction: { mode: 'index', intersect: true },
                        layout: { padding: { top: 20 } }
                      }} 
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-2">Click on any bar to see detailed student statistics</p>
                </div>
              )}

              {selectedStudent && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="p-4 bg-blue-50 rounded-full shrink-0">
                    <User className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">{selectedStudent.name}</h4>
                        <p className="text-sm text-gray-500">@{selectedStudent.username} • {selectedStudent.className}</p>
                      </div>
                      <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={20} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-y-4 gap-x-4 border-t pt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Total XP</p>
                        <p className="text-2xl font-bold text-blue-600">{selectedStudent.xpTotals.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Course %</p>
                        <p className="text-2xl font-bold text-green-600">{selectedStudent.percentageCompleted}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Time Spent</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {Math.floor(selectedStudent.timeSpentMinutes / 60)}h {selectedStudent.timeSpentMinutes % 60}m
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Practice Days</p>
                        <p className="text-2xl font-bold text-orange-500">{selectedStudent.practiceDays}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Lessons</p>
                        <p className="text-2xl font-bold text-pink-600">{selectedStudent.lessons}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">Stories</p>
                        <p className="text-2xl font-bold text-yellow-600">{selectedStudent.stories}</p>
                      </div>
                    </div>

                    {studentProgressChartData && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <h5 className="text-sm font-semibold text-gray-800 mb-4 tracking-tight">Individual Progression</h5>
                        <div className="h-48">
                          <Line 
                            data={studentProgressChartData}
                            options={{ 
                              maintainAspectRatio: false,
                              scales: { y: { beginAtZero: true } },
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

              {progressChartData && progressChartData.labels.length > 1 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 tracking-tight">Class Progression Over Time</h3>
                  <div className="h-80">
                    <Line 
                      data={progressChartData}
                      options={{ 
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true } },
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
    </div>
  );
}
