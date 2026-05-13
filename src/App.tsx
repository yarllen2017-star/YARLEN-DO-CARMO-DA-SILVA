/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  collection, 
  addDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp,
  getDocFromServer,
  doc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserPlus, 
  Search, 
  Calendar as CalendarIcon, 
  Mic, 
  Square, 
  CheckCircle2,
  Lock,
  LogOut,
  ChevronRight,
  History,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// --- Types ---

interface Person {
  id?: string;
  name: string;
  birthDate?: string;
  whatsapp: string;
  story?: string;
  type: 'visitor' | 'member';
  createdAt: Timestamp;
  isReturn?: boolean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Helpers ---

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error("Erro de permissão no banco de dados. Verifique as regras.");
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState<Date | undefined>(undefined);
  const [searchName, setSearchName] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [story, setStory] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('register');
  const [reportTab, setReportTab] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Duplicate Check State
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingType, setPendingType] = useState<'visitor' | 'member' | null>(null);

  const recognitionRef = useRef<any>(null);

  // Duplicate check logic
  useEffect(() => {
    if (name.length > 3) {
      const exists = people.some(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
      // Only show if not already submitting and the name is reasonably long
    }
  }, [name, people]);

  // Mask for Date (DD/MM/YYYY)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    let maskedValue = '';
    if (value.length > 0) {
      maskedValue = value.slice(0, 2);
      if (value.length > 2) {
        maskedValue += '/' + value.slice(2, 4);
        if (value.length > 4) {
          maskedValue += '/' + value.slice(4, 8);
        }
      }
    }
    setBirthDateInput(maskedValue);
  };

  // Auth Verification
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Real-time Data
  useEffect(() => {
    if (!isLoggedIn) return;

    const q = query(collection(db, 'people'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Person[];
      setPeople(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'people');
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  const handleDelete = async (personId: string | undefined) => {
    if (!personId) return;
    
    try {
      await deleteDoc(doc(db, 'people', personId));
      toast.success("Registro apagado com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `people/${personId}`);
    }
  };

  // Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().toUpperCase() === 'KERIGMA') {
      setIsLoggedIn(true);
      toast.success("Bem-vindo ao Acolhimento Kerigma!");
    } else {
      toast.error("Usuário incorreto. Tente 'KERIGMA'.");
    }
  };

  // Form Submission
  const handleSubmit = async (type: 'visitor' | 'member', confirmedReturn: boolean = false) => {
    if (!name || !whatsapp) {
      toast.error("Por favor, preencha o nome e o WhatsApp.");
      return;
    }

    // Check for duplicate if not already confirmed
    if (!confirmedReturn) {
      const isDuplicate = people.some(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (isDuplicate) {
        setPendingType(type);
        setShowDuplicateDialog(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Validate date format if provided
      let formattedBirthDate = '';
      if (birthDateInput) {
        if (birthDateInput.length !== 10) {
          toast.error("Data de nascimento incompleta. Use o formato DD/MM/AAAA.");
          setSubmitting(false);
          return;
        }
        const [day, month, year] = birthDateInput.split('/');
        formattedBirthDate = `${year}-${month}-${day}`;
      }

      await addDoc(collection(db, 'people'), {
        name,
        birthDate: formattedBirthDate,
        whatsapp,
        story,
        type,
        isReturn: confirmedReturn,
        createdAt: Timestamp.now()
      });
      
      toast.success(`${type === 'visitor' ? 'Visitante' : 'Membro'} cadastrado com sucesso!${confirmedReturn ? ' (Registrado como retorno)' : ''}`);
      
      // Reset form
      setName('');
      setBirthDateInput('');
      setWhatsapp('');
      setStory('');
      setShowDuplicateDialog(false);
      setPendingType(null);
      
      // Switch to list tab to see the result
      setActiveTab('list');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'people');
    } finally {
      setSubmitting(false);
    }
  };

  // Voice Recording (Speech to Text)
  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'pt-BR';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onstart = () => setIsRecording(true);
    recognitionRef.current.onend = () => setIsRecording(false);
    
    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setStory(prev => prev + event.results[i][0].transcript + ' ');
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
    };

    recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Filtered List
  const filteredPeople = people.filter(p => {
    const matchesDate = !searchDate || isSameDay(p.createdAt.toDate(), searchDate);
    const matchesName = !searchName || p.name.toLowerCase().includes(searchName.toLowerCase());
    return matchesDate && matchesName;
  });

  // Reporting Logic
  const getMonthlyData = () => {
    const months: Record<string, { month: string; count: number; visitors: Person[] }> = {};
    
    people.forEach(p => {
      const date = p.createdAt.toDate();
      const monthKey = format(date, 'MMM/yy', { locale: ptBR });
      if (!months[monthKey]) {
        months[monthKey] = { month: monthKey, count: 0, visitors: [] };
      }
      months[monthKey].count++;
      months[monthKey].visitors.push(p);
    });

    return Object.values(months).reverse();
  };

  const getReturnees = () => {
    const counts: Record<string, { person: Person; dates: Date[]; count: number }> = {};
    
    people.forEach(p => {
      const key = p.name.toLowerCase().trim();
      if (!counts[key]) {
        counts[key] = { person: p, dates: [], count: 0 };
      }
      counts[key].count++;
      counts[key].dates.push(p.createdAt.toDate());
    });

    return Object.values(counts)
      .filter(v => v.count > 1)
      .sort((a, b) => b.count - a.count);
  };

  const monthlyData = getMonthlyData();
  const returneesData = getReturnees();

  // Helper to check if a person is a returnee (more than 1 visit in total history)
  const isPersonReturnee = (name: string) => {
    return people.filter(p => p.name.toLowerCase().trim() === name.toLowerCase().trim()).length > 1;
  };

  const Logo = ({ className }: { className?: string }) => (
    <img 
      src="https://storage.googleapis.com/static.antigravity.dev/ed417edd-68e4-464a-bc75-3dc9061580bd/attachments/1.png" 
      alt="Kerigma Logo" 
      referrerPolicy="no-referrer"
      className={cn("object-contain", className)}
    />
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
        <Toaster position="top-center" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-2xl bg-white overflow-hidden">
            <div className="h-2 bg-zinc-900" />
            <CardHeader className="space-y-1 text-center pb-8">
              <div className="mx-auto bg-zinc-900 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-xl border-4 border-white overflow-hidden">
                <Users className="text-white w-10 h-10" />
              </div>
              <CardTitle className="text-3xl font-black tracking-tighter text-zinc-900 uppercase">Igreja Kerigma</CardTitle>
              <CardDescription className="text-zinc-500 font-normal text-sm">Um lugar de acolhimento</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-zinc-700">Usuário</Label>
                  <Input 
                    id="username"
                    placeholder="Digite o usuário..." 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 border-zinc-200 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                  />
                </div>
                <Button type="submit" className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group">
                  Entrar
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
            </CardContent>
            <CardFooter className="bg-zinc-50 py-4 flex justify-center">
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Kerigma Church • Acolhimento</p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-zinc-900 p-2 rounded-lg shadow-sm w-10 h-10 flex items-center justify-center">
              <Users className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight leading-tight">Kerigma Acolhimento</h1>
              <p className="hidden md:block text-xs text-zinc-500 font-medium uppercase tracking-wider">Gestão de Visitantes e Membros</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsLoggedIn(false)}
            className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-full px-4"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-zinc-200/50 p-1 rounded-2xl h-14 w-full max-w-lg border border-zinc-200">
              <TabsTrigger value="register" className="rounded-xl flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 text-zinc-500 font-medium transition-all gap-2 px-3">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Cadastrar</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="rounded-xl flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 text-zinc-500 font-medium transition-all gap-2 px-3">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Cadastrados</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-xl flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 text-zinc-500 font-medium transition-all gap-2 px-3">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Relatórios</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <TabsContent value="register">
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-2xl mx-auto px-2"
              >
                <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-bold">Novo Cadastro</CardTitle>
                    <CardDescription>Preencha as informações do visitante ou novo membro</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-semibold">Nome Completo</Label>
                        <Input 
                          id="name" 
                          placeholder="Ex: João Silva" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="rounded-xl border-zinc-200 focus:ring-zinc-900"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birthDate" className="text-sm font-semibold">Data de Nascimento</Label>
                        <Input 
                          id="birthDate" 
                          placeholder="DD/MM/AAAA" 
                          value={birthDateInput}
                          onChange={handleDateChange}
                          className="rounded-xl border-zinc-200 focus:ring-zinc-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="whatsapp" className="text-sm font-semibold">Número de WhatsApp</Label>
                      <Input 
                        id="whatsapp" 
                        placeholder="(00) 00000-0000" 
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        className="rounded-xl border-zinc-200 focus:ring-zinc-900"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="story" className="text-sm font-semibold">Resumo da História</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          type="button"
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`rounded-full h-8 px-3 gap-2 transition-all ${isRecording ? 'bg-red-50 text-red-600 hover:bg-red-100 animate-pulse' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                        >
                          {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3 h-3" />}
                          {isRecording ? 'Gravando...' : 'Usar Voz'}
                        </Button>
                      </div>
                      <Textarea 
                        id="story" 
                        placeholder="Conte um pouco sobre a pessoa..." 
                        className="min-h-[120px] rounded-xl border-zinc-200 focus:ring-zinc-900 resize-none"
                        value={story}
                        onChange={(e) => setStory(e.target.value)}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-zinc-50/50 p-6 flex flex-col sm:flex-row gap-4 border-t border-zinc-100">
                    <Button 
                      onClick={() => handleSubmit('visitor')}
                      disabled={submitting}
                      className="flex-1 h-12 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 font-bold rounded-xl shadow-sm transition-all gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Cadastrar Visitante
                    </Button>
                    <Button 
                      onClick={() => handleSubmit('member')}
                      disabled={submitting}
                      className="flex-1 h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl shadow-lg transition-all gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Cadastrar Novo Membro
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="list">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 px-2"
              >
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-zinc-200">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="bg-zinc-100 p-3 rounded-2xl">
                      <Search className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div className="flex-1">
                      <Input 
                        placeholder="Buscar por nome..." 
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        className="border-none bg-transparent focus-visible:ring-0 h-auto p-0 font-bold text-lg placeholder:text-zinc-400"
                      />
                      <p className="text-xs text-zinc-500">Busque por nome ou data</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Popover>
                      <PopoverTrigger>
                        <div
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "flex h-12 w-full md:w-[240px] items-center justify-start rounded-2xl border border-zinc-200 bg-background px-4 text-sm font-medium transition-all hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                            !searchDate && "text-zinc-400"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {searchDate ? format(searchDate, "PPP", { locale: ptBR }) : <span>Filtrar por data</span>}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={searchDate}
                          onSelect={setSearchDate}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    {searchDate && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSearchDate(undefined)}
                        className="text-zinc-400 hover:text-zinc-900"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>

                <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-zinc-50/50">
                        <TableRow className="hover:bg-transparent border-zinc-100">
                          <TableHead className="font-bold text-zinc-900 py-6 pl-6">Pessoa</TableHead>
                          <TableHead className="hidden md:table-cell font-bold text-zinc-900">Tipo</TableHead>
                          <TableHead className="hidden md:table-cell font-bold text-zinc-900">WhatsApp</TableHead>
                          <TableHead className="font-bold text-zinc-900 text-right pr-6">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-20 text-zinc-400">
                              Carregando registros...
                            </TableCell>
                          </TableRow>
                        ) : filteredPeople.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-20 text-zinc-400">
                              Nenhum registro encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredPeople.map((person) => (
                            <TableRow key={person.id} className="group hover:bg-zinc-50/50 transition-colors border-zinc-100">
                              <TableCell className="py-4 pl-6">
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-zinc-900">{person.name}</div>
                                  {(person.isReturn || isPersonReturnee(person.name)) && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" title="Visitante de Retorno" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                                    {format(person.createdAt.toDate(), 'dd/MM/yy')}
                                  </span>
                                  <Badge 
                                    variant="secondary" 
                                    className={`md:hidden rounded-full px-2 py-0 text-[8px] font-bold uppercase tracking-wider border-none ${
                                      person.type === 'visitor' 
                                        ? 'bg-blue-50 text-blue-600' 
                                        : 'bg-emerald-50 text-emerald-600'
                                    }`}
                                  >
                                    {person.type === 'visitor' ? 'V' : 'M'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge 
                                  variant="secondary" 
                                  className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider border-none ${
                                    person.type === 'visitor' 
                                      ? 'bg-blue-50 text-blue-600' 
                                      : 'bg-emerald-50 text-emerald-600'
                                  }`}
                                >
                                  {person.type === 'visitor' ? 'Visitante' : 'Membro'}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell font-mono text-sm text-zinc-600">
                                {person.whatsapp}
                              </TableCell>
                              <TableCell className="text-right pr-6">
                              <Popover>
                                <PopoverTrigger>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-200 transition-colors cursor-pointer"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 rounded-2xl shadow-2xl border-zinc-100 p-6" align="end">
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${person.type === 'visitor' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <Users className="w-5 h-5" />
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-zinc-900">{person.name}</h4>
                                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">{person.type === 'visitor' ? 'Visitante' : 'Novo Membro'}</p>
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div className="space-y-1">
                                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">WhatsApp</p>
                                        <p className="text-sm font-medium">{person.whatsapp}</p>
                                      </div>
                                      {person.birthDate && (
                                        <div className="space-y-1">
                                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Nascimento</p>
                                          <p className="text-sm font-medium">{format(parseISO(person.birthDate), 'dd/MM/yyyy')}</p>
                                        </div>
                                      )}
                                      <div className="space-y-1">
                                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">História</p>
                                        <p className="text-sm text-zinc-600 leading-relaxed italic">
                                          {person.story || "Nenhuma história registrada."}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="pt-4 border-t border-zinc-100 flex justify-end">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => handleDelete(person.id)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl gap-2 w-full"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Apagar Dados
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </motion.div>
            </TabsContent>

            <TabsContent value="reports">
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-zinc-200">
                  <div className="flex gap-2">
                    <Button 
                      variant={reportTab === 'monthly' ? "default" : "ghost"}
                      onClick={() => setReportTab('monthly')}
                      className="rounded-2xl px-6"
                    >
                      Visitas no Mês
                    </Button>
                    <Button 
                      variant={reportTab === 'returnees' ? "default" : "ghost"}
                      onClick={() => setReportTab('returnees')}
                      className="rounded-2xl px-6"
                    >
                      Retornos
                    </Button>
                  </div>
                </div>

                {reportTab === 'monthly' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 border-none shadow-xl bg-white rounded-[2rem] p-6">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <CardTitle>Visitas Mensais</CardTitle>
                          <CardDescription>Evolução de acolhimentos por mês</CardDescription>
                        </div>
                        <TrendingUp className="text-zinc-400 w-6 h-6" />
                      </div>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="month" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                            />
                            <Tooltip 
                              cursor={{ fill: '#f4f4f5' }}
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar 
                              dataKey="count" 
                              name="Visitas" 
                              radius={[6, 6, 0, 0]}
                              onClick={(data) => setSelectedMonth(data.month === selectedMonth ? null : data.month)}
                              className="cursor-pointer"
                            >
                              {monthlyData.map((entry) => (
                                <Cell 
                                  key={entry.month} 
                                  fill={entry.month === selectedMonth ? '#18181b' : '#e4e4e7'} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden flex flex-col">
                      <CardHeader className="bg-zinc-50/50">
                        <CardTitle className="text-lg">Filtro Detalhado</CardTitle>
                        <CardDescription>
                          {selectedMonth ? `Visitantes em ${selectedMonth}` : 'Selecione um mês no gráfico'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 overflow-y-auto max-h-[400px] pt-4 p-0">
                        {!selectedMonth ? (
                          <div className="flex flex-col items-center justify-center p-12 text-center">
                            <BarChart3 className="w-12 h-12 text-zinc-200 mb-4" />
                            <p className="text-zinc-400 font-medium">Selecione uma barra para ver os nomes</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-100">
                            {monthlyData.find(m => m.month === selectedMonth)?.visitors.map((v) => (
                              <div key={v.id} className="px-6 py-4 hover:bg-zinc-50 transition-colors">
                                <p className="font-bold text-zinc-900">{v.name}</p>
                                <div className="flex justify-between items-center mt-1">
                                  <p className="text-xs text-zinc-500">{format(v.createdAt.toDate(), 'dd/MM/yyyy')}</p>
                                  <Badge className={v.type === 'visitor' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}>
                                    {v.type === 'visitor' ? 'V' : 'M'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-zinc-50/50 p-8">
                      <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/10 p-3 rounded-2xl">
                          <History className="text-emerald-600 w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle>Retornos de Visitas</CardTitle>
                          <CardDescription>Pessoas que visitaram a igreja mais de uma vez</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-zinc-100">
                            <TableHead className="font-bold py-6 pl-8">Pessoa</TableHead>
                            <TableHead className="font-bold text-center">Vezes</TableHead>
                            <TableHead className="font-bold">Datas das Visitas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returneesData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-20 text-zinc-400 font-medium">Nenhum retorno identificado ainda.</TableCell>
                            </TableRow>
                          ) : (
                            returneesData.map((data) => (
                              <TableRow key={data.person.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                <TableCell className="py-6 pl-8">
                                  <p className="font-bold text-zinc-900 text-lg">{data.person.name}</p>
                                  <p className="text-zinc-500 text-xs font-mono">{data.person.whatsapp}</p>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="inline-flex items-center justify-center bg-zinc-900 text-white w-10 h-10 rounded-full font-black">
                                    {data.count}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {data.dates.sort((a, b) => b.getTime() - a.getTime()).map((d, di) => (
                                      <Badge key={di} variant="secondary" className="bg-zinc-100 text-zinc-600 font-medium rounded-lg border-none px-2 py-1">
                                        {format(d, 'dd/MM/yy')}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        {/* Duplicate Confirmation Dialog */}
        <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl">
            <DialogHeader className="space-y-3">
              <div className="mx-auto bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mb-2">
                <AlertCircle className="text-amber-500 w-8 h-8" />
              </div>
              <DialogTitle className="text-center text-xl font-bold">Visitante Encontrado</DialogTitle>
              <DialogDescription className="text-center text-zinc-600">
                O nome <span className="font-bold text-zinc-900">"{name}"</span> já existe em nossa base de dados.
                Deseja registrar essa nova entrada como um <span className="font-bold text-emerald-600">retorno</span>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setPendingType(null);
                }}
                className="flex-1 rounded-xl"
              >
                Não, cancelar
              </Button>
              <Button 
                variant="secondary"
                onClick={() => pendingType && handleSubmit(pendingType, false)}
                className="flex-1 rounded-xl"
              >
                Sim, novo cadastro
              </Button>
              <Button 
                onClick={() => pendingType && handleSubmit(pendingType, true)}
                className="flex-1 bg-zinc-900 text-white rounded-xl shadow-lg"
              >
                Sim, registrar retorno
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-[0.2em]">
          © 2024 Kerigma Church • Sistema de Acolhimento
        </p>
      </footer>
    </div>
  );
}
