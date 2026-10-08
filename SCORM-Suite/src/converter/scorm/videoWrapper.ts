export function buildVideoWrapper(videoFileName: string, courseTitle: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${courseTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #011932;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'Poppins', 'Segoe UI', sans-serif;
      color: #D9FBFF;
    }

    .container {
      width: 100%;
      max-width: 960px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    h1 {
      font-size: 1.4rem;
      font-weight: 600;
      color: #19F7F1;
      text-align: center;
    }

    .video-wrapper {
      width: 100%;
      background: #012142;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #0FCED3;
    }

    video {
      width: 100%;
      display: block;
      outline: none;
    }

    .status {
      font-size: 0.85rem;
      color: #72A3C4;
      text-align: center;
    }

    .status.done {
      color: #19F7F1;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${courseTitle}</h1>

    <div class="video-wrapper">
      <video id="courseVideo" controls preload="metadata">
        <source src="${videoFileName}" />
        Seu navegador não suporta reprodução de vídeo.
      </video>
    </div>

    <p class="status" id="statusMsg">Assista ao vídeo completo para concluir o módulo.</p>
  </div>

  <script>
    // ── SCORM 1.2 API ──────────────────────────────────────────────
    var API = null;

    function findAPI(win) {
      var attempts = 0;
      while (win.API == null && win.parent != null && win.parent != win) {
        attempts++;
        if (attempts > 10) break;
        win = win.parent;
      }
      return win.API || null;
    }

    function initSCORM() {
      API = findAPI(window);
      if (!API) { console.warn('SCORM API não encontrada.'); return false; }
      var result = API.LMSInitialize('');
      if (result !== 'true' && result !== true) {
        console.warn('LMSInitialize falhou.');
        return false;
      }
      API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
      API.LMSCommit('');
      return true;
    }

    function completeSCORM() {
      if (!API) return;
      API.LMSSetValue('cmi.core.lesson_status', 'completed');
      API.LMSSetValue('cmi.core.score.raw', '100');
      API.LMSSetValue('cmi.core.score.min', '0');
      API.LMSSetValue('cmi.core.score.max', '100');
      API.LMSCommit('');
      API.LMSFinish('');
    }

    // ── Lógica do vídeo ──────────────────────────────────────────
    var video = document.getElementById('courseVideo');
    var statusMsg = document.getElementById('statusMsg');
    var completed = false;

    initSCORM();

    video.addEventListener('ended', function () {
      if (completed) return;
      completed = true;
      statusMsg.textContent = '✓ Módulo concluído!';
      statusMsg.classList.add('done');
      completeSCORM();
    });

    // Marcar como concluído também se assistiu 95% do vídeo
    video.addEventListener('timeupdate', function () {
      if (completed) return;
      if (video.duration > 0 && (video.currentTime / video.duration) >= 0.95) {
        completed = true;
        statusMsg.textContent = '✓ Módulo concluído!';
        statusMsg.classList.add('done');
        completeSCORM();
      }
    });
  </script>
</body>
</html>`;
}
