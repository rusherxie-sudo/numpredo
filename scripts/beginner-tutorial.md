# 初級No.1 完整教程产物

网页数据来自固定初级题库No.1，不得更改题序。网页43步、题目PDF和24页解答PDF共享教学数据。

通过工作区 tools/dev/run numpredo 在本工作树执行命令。生成依赖独立Python环境中的 reportlab==5.1.0、pypdf==7.1.0；字体复用 gen-print-pdfs.py 的日文Arial Unicode注册。生成命令为 `python scripts/gen-beginner-tutorial.py`，先验证实际PDF的棋盘/高亮/215句理由/字体/A4，再写入哈希清单。

最终发布验收必须直接检查已存在的产物，不能先重生成掩盖坏文件：

```bash
node scripts/check-beginner-walkthrough.ts
python scripts/check-beginner-tutorial-pdf.py --built
```

第二条使用安装了pypdf的隔离Python。检查public与dist全部25页的实际PDF内容及字节一致性，不写任何产物。云端静态构建用postbuild检查实际HTML的43张步骤棋盘、首末棋盘、完整理由和PDF哈希，锁定本地语义验收通过的文件，无需在Cloudflare安装PDF生成/解析依赖。

更改PDF版式时需同步坐标契约并重新目视检查。内容提交后生成sitemap lastmod，再对最终精确SHA运行仓库发布候选检查。
