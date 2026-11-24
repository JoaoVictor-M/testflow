// JWT sem assinatura real: o front só decodifica as claims, quem valida é o servidor.
const encode = (value) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export const fakeToken = (claims) => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.assinatura`;
