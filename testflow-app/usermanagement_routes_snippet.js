
// --- ROTAS DE USUÁRIOS ---
app.get('/api/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ username: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const userId = req.params.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        if (username) user.username = username;
        if (role) user.role = role;
        if (password && password.trim() !== '') {
            user.password = password; // O pre-save hook do Mongoose vai fazer o hash
        }

        await user.save();
        res.status(200).json({ message: 'Usuário atualizado com sucesso', user: { _id: user._id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const userId = req.params.id;
        // Prevenir auto-deleção (opcional mas recomendado)
        if (req.user.userId === userId) {
            return res.status(400).json({ message: 'Você não pode deletar a si mesmo.' });
        }

        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }
        res.status(200).json({ message: 'Usuário deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
