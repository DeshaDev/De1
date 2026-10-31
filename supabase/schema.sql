-- ==============================================================================
-- قاعدة بيانات منصة بصيرة / أنا سمسم على Supabase
-- Baseera / AnaSimsim Database Schema with Row Level Security (RLS)
-- ==============================================================================
-- قم بنسخ هذا الملف بالكامل ولصقه في تبويب SQL Editor في لوحة تحكم Supabase
-- واضغط Run لإنشاء الجداول وسياسات الحماية وقواعد الأمان تلقائياً.
-- ==============================================================================

-- 1. جدول الملف الشخصي للمستخدم (Profile) مرتبط بتسجيل الدخول (Google / Email)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'educator_admin',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. جدول سجلات الطلاب (Students)
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    grade TEXT NOT NULL DEFAULT 'غير محدد',
    age INTEGER,
    dialect TEXT DEFAULT 'faseeh',
    guardian_consent BOOLEAN DEFAULT TRUE,
    guardian_consent_source TEXT,
    guardian_consent_recorded_at TEXT,
    notes TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. جدول نتائج فحص الوعي الصوتي والبطارية المعرفية (Cognitive Battery Assessments)
CREATE TABLE IF NOT EXISTS public.cognitive_assessments (
    id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    score NUMERIC,
    accuracy_percent NUMERIC,
    status TEXT DEFAULT 'completed',
    subtests_data JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. جدول جلسات القراءة الشفهية وتقييم النطق (Oral Reading Sessions)
CREATE TABLE IF NOT EXISTS public.oral_reading_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    passage_id TEXT,
    wpm NUMERIC DEFAULT 0,
    accuracy_percent NUMERIC DEFAULT 0,
    problematic_words TEXT[] DEFAULT '{}',
    ai_verified BOOLEAN DEFAULT FALSE,
    assessment_details JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. جدول تقدم البرنامج التدريبي التفاعلي (Training Progress)
CREATE TABLE IF NOT EXISTS public.training_progress (
    id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    station TEXT NOT NULL,
    progress_percent NUMERIC DEFAULT 0,
    completed_milestones TEXT[] DEFAULT '{}',
    details JSONB,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- تفعيل سياسات الأمان والحماية التامة (Row Level Security - RLS)
-- تضمن أن كل معلم/مستخدم لا يرى ولا يعدل إلا بيانات طلابه فقط
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oral_reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

-- سياسات جدول profiles
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- سياسات جدول students
CREATE POLICY "Users can view own students" 
ON public.students FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own students" 
ON public.students FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own students" 
ON public.students FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own students" 
ON public.students FOR DELETE 
USING (auth.uid() = user_id);

-- سياسات جدول cognitive_assessments
CREATE POLICY "Users can view own assessments" 
ON public.cognitive_assessments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments" 
ON public.cognitive_assessments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- سياسات جدول oral_reading_sessions
CREATE POLICY "Users can view own reading sessions" 
ON public.oral_reading_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading sessions" 
ON public.oral_reading_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- سياسات جدول training_progress
CREATE POLICY "Users can view own training progress" 
ON public.training_progress FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own training progress" 
ON public.training_progress FOR ALL 
USING (auth.uid() = user_id);

-- ==============================================================================
-- دالة وتريجر لتسجيل الملف الشخصي تلقائياً فور تسجيل الدخول عبر Google
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'معلم بصيرة'),
        COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ربط الدالة بجدول مستخدمي auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
