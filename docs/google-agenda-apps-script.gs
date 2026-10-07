/**
 * Ponte entre o sistema Chef Hilana Maia e a Google Agenda.
 *
 * Este script roda DENTRO da conta Google dona da agenda (chefhilanamaia@gmail.com)
 * e é publicado como "app da Web". O sistema envia os pedidos para o endereço
 * dele, junto com uma senha; o script confere a senha e cria/atualiza/apaga os
 * eventos na agenda principal da conta.
 *
 * Passo a passo no arquivo CLAUDE.md (seção "Google Agenda", "Jeito 1 — Apps Script").
 */

// 1) Troque pelo texto da SUA senha: inventada por você, longa (30+ caracteres,
//    só letras e números). A MESMA senha vai na variável GOOGLE_APPS_SCRIPT_TOKEN
//    do Vercel e do .env.local. Nunca envie essa senha por chat ou e-mail.
var SENHA = 'COLE_AQUI_A_SENHA';

var FUSO = 'America/Sao_Paulo';
var FORMATO_DATA = "yyyy-MM-dd'T'HH:mm:ss";

// Rode esta função UMA vez no editor (botão "Executar") só para a Google pedir
// a permissão de acesso à agenda. Depois disso ela não precisa mais ser usada.
function autorizar() {
  CalendarApp.getDefaultCalendar().getName();
}

// Abrir o endereço do app da Web no navegador mostra esta resposta — serve para
// conferir que a publicação deu certo.
function doGet() {
  return responder({ ok: true, mensagem: 'Ponte com a Google Agenda ativa.' });
}

function doPost(e) {
  var trava = LockService.getScriptLock();
  try {
    // Um pedido de cada vez: o sistema pode mandar vários lotes ao mesmo tempo
    // e o serviço de agenda do Google reclama de chamadas simultâneas.
    trava.waitLock(30000);

    if (!SENHA || SENHA === 'COLE_AQUI_A_SENHA') {
      return responder({ erro: 'A senha do script ainda não foi definida (variável SENHA, no topo do código).' });
    }

    var dados = JSON.parse(e.postData.contents);
    if (dados.token !== SENHA) {
      return responder({ erro: 'Senha inválida: confira se GOOGLE_APPS_SCRIPT_TOKEN é igual à SENHA do script.' });
    }

    var agenda = CalendarApp.getDefaultCalendar();
    var resultados = (dados.operacoes || []).map(function (operacao) {
      try {
        return { ok: true, eventoId: processar(agenda, operacao) };
      } catch (erro) {
        return { ok: false, erro: mensagem(erro) };
      }
    });
    return responder({ resultados: resultados });
  } catch (erro) {
    return responder({ erro: mensagem(erro) });
  } finally {
    if (trava.hasLock()) trava.releaseLock();
  }
}

// Cria, atualiza ou apaga UM evento e devolve o id dele (ou null se foi apagado).
function processar(agenda, operacao) {
  var evento = operacao.eventoId ? agenda.getEventById(operacao.eventoId) : null;

  if (operacao.excluir) {
    if (evento) evento.deleteEvent();
    return null;
  }

  var inicio = Utilities.parseDate(operacao.inicio, FUSO, FORMATO_DATA);
  var fim = Utilities.parseDate(operacao.fim, FUSO, FORMATO_DATA);

  if (evento) {
    evento.setTitle(operacao.titulo);
    evento.setDescription(operacao.descricao);
    evento.setTime(inicio, fim);
    return evento.getId();
  }
  return agenda.createEvent(operacao.titulo, inicio, fim, { description: operacao.descricao }).getId();
}

function mensagem(erro) {
  return String((erro && erro.message) || erro);
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
