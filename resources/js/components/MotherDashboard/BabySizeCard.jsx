import React, { useState } from 'react';
import { Baby, Info, ChevronRight } from 'lucide-react';
import '../../styles/components/BabySizeCard.css';
import avocadoImg from '../../assets/images/baby-size/avocado.png';
import watermelonImg from '../../assets/images/baby-size/watermelon.png';
import raspberryImg from '../../assets/images/baby-size/raspberry.png';
import BabySizeModal from './BabySizeModal';

export const sizeMapping = {
    8: { name: 'Raspberry', length: '1.6 cm', weight: '1 g', fact: 'Your baby is now the size of a raspberry!', image: raspberryImg, emoji: '🍓', color: 'card-pastel-pink' },
    12: { name: 'Lime', length: '5.4 cm', weight: '14 g', fact: 'Your baby can now make a fist!', image: null, emoji: '🍋', color: 'card-pastel-green' },
    16: { name: 'Avocado', length: '11.6 cm', weight: '100 g', fact: 'Your baby is starting to grow hair!', image: avocadoImg, emoji: '🥑', color: 'card-pastel-green' },
    20: { name: 'Banana', length: '25 cm', weight: '300 g', fact: 'Your baby can now swallow!', image: null, emoji: '🍌', color: 'card-pastel-orange' },
    24: { name: 'Corn', length: '30 cm', weight: '600 g', fact: 'Your baby is developing taste buds!', image: null, emoji: '🌽', color: 'card-pastel-orange' },
    28: { name: 'Eggplant', length: '37 cm', weight: '1 kg', fact: 'Your baby can now hear your voice!', image: null, emoji: '🍆', color: 'card-pastel-purple' },
    32: { name: 'Squash', length: '42 cm', weight: '1.7 kg', fact: 'Your baby is practicing breathing!', image: null, emoji: '🎃', color: 'card-pastel-purple' },
    36: { name: 'Papaya', length: '47 cm', weight: '2.5 kg', fact: 'Your baby is quickly gaining weight!', image: null, emoji: '🍈', color: 'card-pastel-orange' },
    40: { name: 'Watermelon', length: '51 cm', weight: '3.5 kg', fact: 'Your baby is ready to meet you!', image: watermelonImg, emoji: '🍉', color: 'card-pastel-green' },
};

const BabySizeCard = ({ currentWeek = 28 }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Find the closest mapping for the current week
    const weeks = Object.keys(sizeMapping).map(Number).sort((a, b) => b - a);
    const targetWeek = weeks.find(w => currentWeek >= w) || 8;
    const data = sizeMapping[targetWeek];

    return (
        <>
            <div className={`baby-size-card ${data.color}`} onClick={() => setIsModalOpen(true)}>
                <div className="baby-size-header">
                    <h2 className="baby-size-title">Baby Size This Week</h2>
                    <span className="baby-size-week-badge">{currentWeek} Weeks</span>
                </div>

                <div className="baby-size-image-container">
                    {data.image ? (
                        <img src={data.image} alt={data.name} className="baby-size-image" />
                    ) : (
                        <span style={{ fontSize: '80px' }}>{data.emoji}</span>
                    )}
                </div>

                <p className="baby-size-fruit-name">{data.name}</p>

                <div className="baby-size-stats">
                    <span className="baby-size-stat-item">{data.length}</span>
                    <span className="baby-size-stat-item">{data.weight}</span>
                </div>

                <p className="baby-size-fun-fact">
                    {data.fact}
                </p>

                <div className="baby-size-footer">
                    Learn more about development <ChevronRight size={14} />
                </div>
            </div>

            {isModalOpen && (
                <BabySizeModal 
                    week={currentWeek} 
                    data={data} 
                    onClose={() => setIsModalOpen(false)} 
                />
            )}
        </>
    );
};

export default BabySizeCard;
