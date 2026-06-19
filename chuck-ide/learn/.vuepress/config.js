import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import { resolve } from 'path'

export default defineUserConfig({
  bundler: viteBundler(),
  theme: defaultTheme(),
  base: '/learn',
  dest: resolve(process.cwd(), "dist/learn")
})