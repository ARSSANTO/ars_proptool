const alpha = (v) => `rgba(var(${v}), <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        s0: 'var(--s0)',
        s1: 'var(--s1)',
        s2: 'var(--s2)',
        s3: 'var(--s3)',
        pop: 'var(--pop)',
        lift: 'var(--lift)',
        badge: 'var(--badge)',
        field: 'var(--field)',
        ln: 'var(--ln)',
        ln2: 'var(--ln2)',
        tx: alpha('--ink-rgb'),
        mu: 'var(--mu)',
        fa: 'var(--fa)',
        ac: alpha('--ac-rgb'),
        acs: 'var(--acs)',
        pr: 'var(--pr)',
        opr: 'var(--opr)',
        dg: alpha('--dg-rgb'),
        dgs: 'var(--dgs)',
        ok: alpha('--ok-rgb'),
        oks: 'var(--oks)',
        wn: alpha('--wn-rgb'),
        wns: 'var(--wns)',
      },
      boxShadow: {
        ui: 'var(--shadow)',
        pop: 'var(--pop-shadow)',
      },
      fontFamily: {
        sans: ['Oswald', 'sans-serif'],
        display: ['Barlow Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
