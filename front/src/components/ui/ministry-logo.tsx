interface Props {
  className?: string;
}

export default function MinistryLogo({ className = "w-8 h-8" }: Props) {
  return (
    <img
      src="/vaz-logo.png"
      alt="Vazirlik Logotipi"
      className={`object-contain ${className}`}
    />
  );
}
