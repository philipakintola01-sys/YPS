import Image from 'next/image';

export default function SiteLogo() {
  return (
    <span className="relative block shrink-0 w-[150px] h-[50px] sm:w-[210px] sm:h-[70px]">
      <Image src="/branding/yps-logo-transparent.png" alt="Young People Summit" fill sizes="(max-width: 639px) 150px, 210px" className="object-contain" />
    </span>
  );
}
