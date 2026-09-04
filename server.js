const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execFile } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DOWNLOADS = path.join(ROOT, "downloads");
const YTDLP = process.env.YTDLP_BIN || "yt-dlp";
const FFMPEG = process.env.FFMPEG_BIN || "ffmpeg";

fs.mkdirSync(DOWNLOADS, {recursive:true});

app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));
app.use("/files", express.static(DOWNLOADS));

function validUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(u.protocol)) throw 0;
    return u.toString();
  } catch { throw new Error("Link tidak valid."); }
}

function safe(s) {
  return String(s || "youdown")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ").trim().slice(0,120);
}

function run(args, cb) {
  execFile(YTDLP, args, {maxBuffer: 20*1024*1024, windowsHide:true}, cb);
}

app.post("/api/render", (req,res) => {
  let url;
  try { url = validUrl(req.body.url); } catch(e) {
    return res.status(400).json({ok:false,error:e.message});
  }

  run(["--dump-single-json","--no-playlist","--no-warnings",url], (err, stdout) => {
    if (err) return res.status(400).json({ok:false,error:"Link tidak dapat diproses oleh server."});
    try {
      const x = JSON.parse(stdout);
      const heights = [...new Set((x.formats||[])
        .filter(f => f.vcodec && f.vcodec !== "none" && f.height)
        .map(f => Number(f.height))
        .filter(Boolean))]
        .sort((a,b)=>a-b);

      res.json({
        ok:true,
        data:{
          title:x.title || "Video",
          thumbnail:x.thumbnail || "",
          duration:x.duration || 0,
          uploader:x.uploader || "",
          qualities:heights.filter(h=>[144,240,360,480,720,1080].includes(h))
        }
      });
    } catch {
      res.status(400).json({ok:false,error:"Metadata tidak terbaca."});
    }
  });
});

app.post("/api/download", (req,res) => {
  let url;
  try { url = validUrl(req.body.url); } catch(e) {
    return res.status(400).json({ok:false,error:e.message});
  }

  const type = req.body.type === "audio" ? "audio" : "video";
  const quality = Number(req.body.quality) || (type === "audio" ? 192 : 720);
  const job = crypto.randomUUID();
  const template = path.join(DOWNLOADS, `${job}-%(title).100B.%(ext)s`);

  let args;
  if (type === "audio") {
    args = [
      "--no-playlist","--no-warnings","--restrict-filenames",
      "-x","--audio-format","mp3","--audio-quality",String(quality)+"K",
      "-o",template,"--ffmpeg-location",FFMPEG,url
    ];
  } else {
    args = [
      "--no-playlist","--no-warnings","--restrict-filenames",
      "-f",`bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`,
      "--merge-output-format","mp4",
      "-o",template,"--ffmpeg-location",FFMPEG,url
    ];
  }

  run(args, (err) => {
    if (err) console.error("YouDown download:", err.message);
  });

  res.json({ok:true,job});
});

app.get("/api/files", (req,res) => {
  const items = fs.readdirSync(DOWNLOADS)
    .filter(x=>x !== ".gitkeep")
    .map(name => {
      const st = fs.statSync(path.join(DOWNLOADS,name));
      return {
        name, size:st.size, updated:st.mtimeMs,
        url:"/files/"+encodeURIComponent(name),
        audio:/\.(mp3|m4a|wav|ogg)$/i.test(name)
      };
    }).sort((a,b)=>b.updated-a.updated);
  res.json({ok:true,data:items});
});

app.delete("/api/files/:name",(req,res)=>{
  const name = path.basename(req.params.name);
  const file = path.join(DOWNLOADS,name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ok:true});
});

app.get("*",(req,res)=>res.sendFile(path.join(ROOT,"public","index.html")));
app.listen(PORT,()=>console.log(`YouDown: http://localhost:${PORT}`));
