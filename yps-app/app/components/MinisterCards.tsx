import Image from 'next/image';

const ministers = [
  { name: 'Apostle Caleb Dada', role: 'Main Minister', photo: '/ministers/caleb-dada.jpg', position: 'center 65%', accent: 'bg-[#E5A93C]', shadow: 'shadow-[8px_8px_0px_#E5A93C]' },
  { name: 'Reverend Timothy Adewuyi', role: 'Host Pastor', photo: '/ministers/timothy-adewuyu.jpg', position: 'center center', accent: 'bg-[#EF7AD5]', shadow: 'shadow-[8px_8px_0px_#EF7AD5]' },
];

export default function MinisterCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 max-w-4xl mx-auto text-left">
      {ministers.map((minister) => (
        <article key={minister.name} className={'overflow-hidden border-4 border-black bg-[#111836] ' + minister.shadow}>
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
            <Image src={minister.photo} alt={minister.name} fill sizes="(max-width: 639px) 100vw, 448px" className="object-cover" style={{ objectPosition: minister.position }} />
          </div>
          <div className="border-t-4 border-black p-5 sm:p-6 space-y-4">
            <span className={'inline-block border-2 border-black px-3 py-1 text-xs font-black uppercase tracking-wider text-black ' + minister.accent}>{minister.role}</span>
            <h3 className="text-xl sm:text-2xl font-black uppercase leading-tight text-white">{minister.name}</h3>
          </div>
        </article>
      ))}
    </div>
  );
}
