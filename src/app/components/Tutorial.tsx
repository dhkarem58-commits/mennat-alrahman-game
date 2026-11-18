import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Hand,
  Sparkles,
  X,
} from 'lucide-react';

interface TutorialProps {
  isOpen: boolean;
  isTouchDevice: boolean;
  onFinish: () => void;
}

export const Tutorial: React.FC<TutorialProps> = ({
  isOpen,
  isTouchDevice,
  onFinish,
}) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    {
      title: '١. حركة الشخصية والتنقّل',
      icon: <Compass className="h-6 w-6 text-[#1E6B47]" />,
      body: isTouchDevice
        ? 'استخدم عصا التحكم اليسرى لتحريك شخصيتك عبر الساحة والجسور المضيئة نحو الجزر الخمس، مع أزرار الجري والقفز في الجانب المقابل.'
        : 'استخدم مفاتيح WASD أو الأسهم للتحرك، واضغط Shift للجري، ومفتاح Space للقفز، أو انقر مباشرة على أي مجسم لتسير الشخصية إليه.',
      tip: 'الجسور الحجرية المضيئة تصل الجزيرة المركزية بكل أبواب العقيدة الخمسة مع حماية تلقائية عند الحواف.',
    },
    {
      title: '٢. الكاميرا وأوضاع الرؤية الثلاثة',
      icon: <Camera className="h-6 w-6 text-[#C8922B]" />,
      body: isTouchDevice
        ? 'اسحب بإصبعك الأيمن على المشهد لتدوير الكاميرا، واستخدم القرص بإصبعين للتقريب أو التبديل إلى الخريطة العلوية.'
        : 'اسحب بالماوس لتدوير الكاميرا واستخدم العجلة للتقريب. يمكنك التبديل بين «وضع اللاعب» و«الاستكشاف الحر» و«الخريطة العلوية» (مفتاح M).',
      tip: 'يمكنك أيضاً الضغط على الخريطة الدائرية المصغرة للانتقال إلى النظرة العلوية.',
    },
    {
      title: '٣. المحطات والتعلّم معلومةً بمعلومة',
      icon: <Hand className="h-6 w-6 text-[#1E6B47]" />,
      body: isTouchDevice
        ? 'عند الاقتراب من أي صرح علمي يتوهج محيطه ويظهر زر «ابدأ المحطة» الكبير لفتح البطاقات والتحديات.'
        : 'اقترب من أي محطة ليظهر زر التفاعل، ثم اضغط E أو Enter لفتح بطاقات الفهم والأدلة والتحديات التفاعلية.',
      tip: 'تُضاف المسائل التي تتعثر فيها تلقائياً إلى بوابة المراجعة الذكية شمال الساحة المركزية.',
    },
    {
      title: '٤. الرفيق النوراني ونجوم المعرفة',
      icon: <Sparkles className="h-6 w-6 text-[#C8922B]" />,
      body: 'يتبعك الرفيق النوراني ليقدم إرشادات موجزة وتلميحات الوجهة التالية. اجمع نجوم المعرفة المتجددة يومياً لفتح ألوان ثياب وحقائب جديدة وألوان إضاءة للرفيق.',
      tip: 'يمكنك إعادة هذا الدليل أو تخصيص الإعدادات في أي وقت بالضغط على قائمة الإعدادات أو Esc.',
    },
  ];

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="الدليل التفاعلي للأكاديمية"
      className="fixed inset-0 z-45 flex items-center justify-center bg-[#171C19]/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#171C19]/15 bg-[#FBF9F4] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#171C19]/12 bg-[#F2ECE1]">
              {cur.icon}
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#1E6B47] tabular-nums">
                خطوة {step + 1} من {steps.length} ·{' '}
                {isTouchDevice ? 'وضع اللمس والهاتف' : 'وضع الحاسوب'}
              </div>
              <h2 className="font-scholar text-lg font-bold text-[#171C19]">{cur.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onFinish}
            aria-label="تخطي الدليل"
            className="rounded-lg p-1.5 text-[#171C19]/50 hover:bg-[#F2ECE1] hover:text-[#171C19]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#171C19]/90">{cur.body}</p>

        <div className="mt-3 rounded-xl border border-[#C8922B]/30 bg-[#C8922B]/10 p-3 text-xs leading-relaxed text-[#6D4D0B]">
          {cur.tip}
        </div>

        {/* Step dots */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-xs transition-all ${
                idx === step ? 'w-6 bg-[#1E6B47]' : 'w-2 bg-[#171C19]/20'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex items-center gap-1 rounded-xl border border-[#171C19]/15 bg-[#F2ECE1] px-3.5 py-2 text-xs font-bold text-[#171C19] hover:bg-[#E7DEC9] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
            <span>السابق</span>
          </button>

          <button
            type="button"
            onClick={onFinish}
            className="rounded-xl px-3 py-2 text-xs font-bold text-[#171C19]/65 hover:text-[#171C19]"
          >
            تخطي
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={onFinish}
              className="flex items-center gap-1.5 rounded-xl bg-[#1E6B47] px-5 py-2 text-xs font-bold text-white hover:bg-[#175538]"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>ابدأ الاستكشاف</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="flex items-center gap-1 rounded-xl bg-[#171C19] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A332E]"
            >
              <span>التالي</span>
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
