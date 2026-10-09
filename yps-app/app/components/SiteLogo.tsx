import Image from 'next/image';

export default function SiteLogo() {
  return (
    <span className="relative block shrink-0 w-[210px] h-[70px]">
      <Image src="/branding/yps-logo-transparent.png" alt="Young People Summit" fill sizes="210px" className="object-contain" />
    </span>
  );
}
