const API = 'https://messageboard-production-ff7b.up.railway.app/api';

const $form = document.getElementById('form');
const $name = document.getElementById('name');
const $message = document.getElementById('message');
const $list = document.getElementById('messages');
const $refresh = document.getElementById('refresh');

let adminToken = localStorage.getItem('adminToken') || '';
const logoutBtn = document.getElementById('logoutAdmin');

// atualiza UI do admin
function updateAdminUI() {
  logoutBtn.style.display = adminToken ? 'block' : 'none';
}

logoutBtn.addEventListener('click', () => {
  adminToken = '';
  localStorage.removeItem('adminToken');
  alert('Saiu do modo admin.');
  updateAdminUI();
  load();
});

updateAdminUI();

// prompt do token
function promptTokenIfNeeded() {
  if (adminToken) return adminToken;
  const t = prompt('Senha de admin para excluir (deixe vazio para cancelar):');
  if (t) {
    adminToken = t.trim();
    localStorage.setItem('adminToken', adminToken);
    updateAdminUI();
  }
  return adminToken;
}

// util fetch
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = 'Erro na requisição';
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// sanitização
function escapeHtml(str){
  return str.replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]
  ));
}

// template da mensagem
function itemTemplate(msg) {
  const date = new Date(msg.created_at);
  const likes = msg.likes ?? 0;
  const dislikes = msg.dislikes ?? 0;
  return `
    <li class="item" data-id="${msg.id}">
      <header>
        <strong>${escapeHtml(msg.name)}</strong>
        <div class="actions-right">
          <button class="like" data-id="${msg.id}" title="Curtir">👍 <span>${likes}</span></button>
          <button class="dislike" data-id="${msg.id}" title="Não curtir">👎 <span>${dislikes}</span></button>
          <button class="delete" data-id="${msg.id}" title="Excluir">Excluir</button>
        </div>
      </header>
      <p>${escapeHtml(msg.message)}</p>
      <div class="meta">
        <span>#${msg.id}</span>
        <time datetime="${date.toISOString()}">${date.toLocaleString()}</time>
      </div>
    </li>`;
}

// carrega lista
async function load() {
  const data = await fetchJSON(`${API}/messages`);
  $list.innerHTML = data.map(itemTemplate).join('');
  const $count = document.getElementById('count');
  if ($count) $count.textContent = data.length;

  // marca voto local
  document.querySelectorAll('.item').forEach(li => {
    const id = li.dataset.id;
    const v = localStorage.getItem(`voted-${id}`);
    li.querySelector('.like')?.classList.toggle('active', v === 'like');
    li.querySelector('.dislike')?.classList.toggle('active', v === 'dislike');
  });
}

// enviar mensagem
$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $name.value.trim();
  const message = $message.value.trim();
  if (!name || !message) return;
  await fetchJSON(`${API}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message })
  });
  $name.value=''; $message.value='';
  await load();
});

// ações de clique
$list.addEventListener('click', async (e) => {
  const likeBtn = e.target.closest('.like');
  const dislikeBtn = e.target.closest('.dislike');
  const delBtn = e.target.closest('.delete');

  const getVote = (id) => localStorage.getItem(`voted-${id}`);
  const setVote = (id, v) => v ? localStorage.setItem(`voted-${id}`, v) : localStorage.removeItem(`voted-${id}`);

  async function sendVote(id, vote, prev) {
    const res = await fetch(`${API}/messages/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote, prev })
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({error:'Erro no voto'}));
      throw new Error(err.error || 'Erro no voto');
    }
    return res.json();
  }

  if (likeBtn) {
    const id = likeBtn.dataset.id;
    const prev = getVote(id) || null;
    const vote = (prev === 'like') ? 'like' : 'like'; // mantém 1 like sempre
    await sendVote(id, vote, prev);
    setVote(id, vote);
    await load();
    return;
  }

  if (dislikeBtn) {
    const id = dislikeBtn.dataset.id;
    const prev = getVote(id) || null;
    const vote = (prev === 'dislike') ? 'dislike' : 'dislike';
    await sendVote(id, vote, prev);
    setVote(id, vote);
    await load();
    return;
  }

  if (delBtn) {
    const id = delBtn.dataset.id;
    const token = promptTokenIfNeeded();
    if (!token) return;
    const res = await fetch(`${API}/messages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 403) {
      alert('Token inválido. Tente novamente.');
      adminToken = ''; localStorage.removeItem('adminToken');
      updateAdminUI();
      return;
    }
    if (!res.ok) { alert('Erro ao excluir mensagem'); return; }
    setVote(id, null);
    await load();
    return;
  }
});

$refresh.addEventListener('click', load);

// init
load().catch(err => {
  console.error(err);
  $list.innerHTML = '<li class="item">Erro ao carregar mensagens. Tente atualizar.</li>';
});
