import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        obsidian: '#0B0E14',
        nebula: '#161B22',
        lavender: '#9D4EDD',
        vqi: {
          excellent: '#2D6A4F',
          good: '#40916C',
          fair: '#D0873F',
          poor: '#21262D',
        },
      },
    },
  },
  plugins: [],
}
export default config
