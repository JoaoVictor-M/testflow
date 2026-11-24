import { act, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import toast from 'react-hot-toast/headless';
import { describe, expect, test } from 'vitest';
import Toaster from '../src/components/Toaster';

const sources = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (
    entry.isDirectory() ? sources(join(directory, entry.name)) : [join(directory, entry.name)]
));

// A política de conteúdo não admite estilo inline: nada pode criar <style> em tempo de execução.
describe('notificações', () => {
    test('mostram a mensagem de sucesso e a de erro sem criar elementos de estilo', async () => {
        const before = document.querySelectorAll('style').length;
        render(<Toaster />);

        await act(async () => { toast.success('Projeto criado com sucesso!'); toast.error('Erro ao salvar projeto.'); });

        expect(screen.getByRole('status')).toHaveTextContent('Projeto criado com sucesso!');
        expect(screen.getByRole('alert')).toHaveTextContent('Erro ao salvar projeto.');
        expect(document.querySelectorAll('style')).toHaveLength(before);
    });

    test('limitam a largura à da tela e quebram a mensagem longa', async () => {
        render(<Toaster />);

        const longa = 'x'.repeat(400);
        await act(async () => { toast.error(longa); });

        const pilha = screen.getByLabelText('Notificações');
        const texto = screen.getByText(longa);
        expect(pilha).toHaveClass('max-w-[calc(100vw-2rem)]', 'sm:max-w-sm');
        expect(texto).toHaveClass('min-w-0', 'break-words');
    });

    test('o código usa só a versão sem estilo do react-hot-toast', () => {
        const offenders = sources('src').filter((file) => /from 'react-hot-toast'/.test(readFileSync(file, 'utf8')));

        expect(offenders).toEqual([]);
    });
});
