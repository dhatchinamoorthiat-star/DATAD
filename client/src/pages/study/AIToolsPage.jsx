import { useEffect, useState } from 'react';
import { Sparkles, FileSearch, FileText, MessageSquare, Search, Loader2, ChevronDown, ChevronUp, Mic, Scale } from 'lucide-react';
import { DAX_CAPABILITY } from '../../utils/dax';
import PageHeader from '../../components/common/PageHeader';
import toast from '../../utils/toast';
import { summariseDoc, reviewResume, askCareerAdvice, semanticSearch, simulateInterview, compareCompanies } from '../../api/dax';
import { listCompanies } from '../../api/companies';
import TierGate from '../../components/common/TierGate';
import { FEATURE } from '../../utils/planFeatures';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';

function ToolPanel({ title, icon: Icon, description, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800/80 dark:bg-gray-900">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
            <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 p-5 dark:border-gray-800">{children}</div>}
    </div>
  );
}

function ResultBox({ content }) {
  if (!content) return null;
  return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-900/20">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
        <Sparkles className="h-3.5 w-3.5" /> Dax
      </p>
      <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{content}</div>
    </div>
  );
}

function DocumentSummarizer() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!text.trim()) return toast.error('Paste some text first');
    setLoading(true);
    try {
      const res = await summariseDoc(text);
      setResult(res.data?.summary || res.data?.result || JSON.stringify(res.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <TierGate feature={FEATURE.AI_SUMMARISE}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a document, case study, or article here…"
        rows={6}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      />
      <button onClick={run} disabled={loading} className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? 'Summarising…' : 'Summarise'}
      </button>
      <ResultBox content={result} />
    </TierGate>
  );
}

function ResumeReviewer() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await reviewResume();
      setResult(res.data?.review || res.data?.result || JSON.stringify(res.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fill your resume first');
    } finally { setLoading(false); }
  };

  return (
    <TierGate feature={FEATURE.AI_RESUME_REVIEW}>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Dax will analyse your saved resume and return structured feedback on each section.</p>
      <button onClick={run} disabled={loading} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
        {loading ? 'Reviewing…' : 'Analyse My Resume'}
      </button>
      <ResultBox content={result} />
    </TierGate>
  );
}

function CareerAdvisor() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!question.trim()) return toast.error('Ask a question');
    setLoading(true);
    try {
      const res = await askCareerAdvice(question);
      setResult(res.data?.advice || res.data?.result || JSON.stringify(res.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <TierGate feature={FEATURE.AI_CAREER_ADVICE}>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="e.g. How do I prepare for a consulting case interview?"
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <button onClick={run} disabled={loading} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          Ask
        </button>
      </div>
      <ResultBox content={result} />
    </TierGate>
  );
}

function SmartSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await semanticSearch(query);
      setResults(res.data?.results || res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Search failed');
    } finally { setLoading(false); }
  };

  const TYPE_COLORS = { note: 'bg-blue-100 text-blue-700', news: 'bg-amber-100 text-amber-700', company: 'bg-emerald-100 text-emerald-700' };

  return (
    <TierGate feature={FEATURE.SEMANTIC_SEARCH}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Ask Dax to find something across your content…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <button onClick={run} disabled={loading} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </div>
      {results && (
        <div className="mt-4 space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-gray-400">No results found.</p>
          ) : results.map((r, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[r.type] || 'bg-gray-100 text-gray-600'}`}>{r.type}</span>
                <p className="text-sm font-medium">{r.title}</p>
              </div>
              {r.excerpt && <p className="text-xs text-gray-500 line-clamp-2">{r.excerpt}</p>}
            </div>
          ))}
        </div>
      )}
    </TierGate>
  );
}

function InterviewSimulator() {
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await simulateInterview({ role, company });
      const d = res.data || {};
      setResult(
        `Q: ${d.question}\n\nFramework: ${d.framework}\n\nModel answer:\n${d.idealAnswer}\n\nLikely follow-ups:\n- ${(d.followUps || []).join('\n- ')}\n\nWatch out: ${d.trap}`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <TierGate feature={FEATURE.AI_INTERVIEW_SIMULATOR} description="A realistic mock interview round tailored to your resume — question, framework, model answer, and the traps to avoid.">
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Target role (e.g. Marketing MT)"
          className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Target company (optional)"
          className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
      </div>
      <button onClick={run} disabled={loading} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        {loading ? 'Preparing round…' : 'Start a round'}
      </button>
      <ResultBox content={result} />
    </TierGate>
  );
}

function CompanyComparator() {
  const [companies, setCompanies] = useState([]);
  const [slugA, setSlugA] = useState('');
  const [slugB, setSlugB] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listCompanies()
      .then((res) => setCompanies(res.data?.companies || res.data || []))
      .catch(() => {});
  }, []);

  const run = async () => {
    if (!slugA || !slugB) return toast.error('Pick two companies');
    if (slugA === slugB) return toast.error('Pick two different companies');
    setLoading(true);
    try {
      const res = await compareCompanies(slugA, slugB);
      const d = res.data || {};
      setResult(
        `Verdict: ${d.verdict}\n\nChoose ${d.companies?.a} if: ${d.chooseAIf}\n\nChoose ${d.companies?.b} if: ${d.chooseBIf}\n\nHow prep differs:\n${d.prepDifference}`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const selectCls =
    'flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900';

  return (
    <TierGate feature={FEATURE.AI_COMPARE_COMPANIES} description="Pit two recruiters against each other and get a decisive verdict from Dax on where to focus your preparation.">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select value={slugA} onChange={(e) => setSlugA(e.target.value)} className={selectCls} aria-label="First company">
          <option value="">First company…</option>
          {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <span className="text-center text-xs font-semibold text-gray-400">vs</span>
        <select value={slugB} onChange={(e) => setSlugB(e.target.value)} className={selectCls} aria-label="Second company">
          <option value="">Second company…</option>
          {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <button onClick={run} disabled={loading} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
        {loading ? 'Comparing…' : 'Compare'}
      </button>
      <ResultBox content={result} />
    </TierGate>
  );
}

export default function AIToolsPage() {
  useDocumentTitle('Dax Studio');

  return (
    <Page>
      <PageHeader
        icon={Sparkles}
        title="Dax Studio"
        subtitle="One assistant, many jobs — summarise, review, advise, research"
      />

      <div className="space-y-4">
        <ToolPanel title={DAX_CAPABILITY.summaries} icon={FileText} description="Paste any text and Dax gives you a concise summary">
          <DocumentSummarizer />
        </ToolPanel>
        <ToolPanel title={DAX_CAPABILITY.resumeReview} icon={FileSearch} description="Dax reviews every section of your saved resume">
          <ResumeReviewer />
        </ToolPanel>
        <ToolPanel title={DAX_CAPABILITY.careerCoach} icon={MessageSquare} description="Ask Dax any career or placement question">
          <CareerAdvisor />
        </ToolPanel>
        <ToolPanel title="Interview Simulator" icon={Mic} description="A realistic mock interview round, tailored to your resume">
          <InterviewSimulator />
        </ToolPanel>
        <ToolPanel title="Company Comparator" icon={Scale} description="Two recruiters, one decisive verdict from Dax">
          <CompanyComparator />
        </ToolPanel>
        <ToolPanel title={DAX_CAPABILITY.research} icon={Search} description="Dax searches across all your notes, news and companies">
          <SmartSearch />
        </ToolPanel>
      </div>
    </Page>
  );
}
