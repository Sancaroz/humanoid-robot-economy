const langButtons = document.querySelectorAll('.lang-btn');
const trElems = document.querySelectorAll('[data-lang="tr"]');
const enElems = document.querySelectorAll('[data-lang="en"]');

function setLanguage(lang){
  langButtons.forEach(btn=>btn.classList.toggle('active', btn.dataset.lang===lang));
  if(lang==='tr'){
    trElems.forEach(el=>el.classList.remove('hidden'));
    enElems.forEach(el=>el.classList.add('hidden'));
    document.documentElement.lang='tr';
  } else {
    trElems.forEach(el=>el.classList.add('hidden'));
    enElems.forEach(el=>el.classList.remove('hidden'));
    document.documentElement.lang='en';
  }
}

langButtons.forEach(btn => {
  btn.addEventListener('click', ()=> setLanguage(btn.dataset.lang));
});

setLanguage('tr');
