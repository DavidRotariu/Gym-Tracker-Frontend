/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa"; // Import heart icons

const ExerciseCard = ({
  exercise,
  index,
  isVideo,
  selectedExercise,
  setSelectedExercise,
  setExercises,
  setLoading,
}: any) => {
  const [isFavorite, setIsFavorite] = useState(false);

  const toggleFavorite = async (event: any) => {
    event.stopPropagation();
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        return;
      }
      const url = exercise.favourite
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/favorites/remove?exercise_id=${exercise.id}`
        : `${process.env.NEXT_PUBLIC_BASE_URL}/favorites/add?exercise_id=${exercise.id}`;

      const method = exercise.favourite ? "DELETE" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExercises(data);
        setIsFavorite(!isFavorite);
      } else {
        console.error("Error toggling favorite:", await response.text());
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setLoading(false);
    }
  };

  const src = exercise.pic.replace(/^\/uploads\//, "");

  return (
    <motion.div
      key={exercise.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onClick={() => setSelectedExercise(exercise)}
      className="relative w-[150px] h-[200px] bg-white rounded-lg shadow-lg flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Top Section (Name) */}
      <div className="ex-slanted-top rounded-t-xl flex items-center justify-start pl-1">
        <p className="text-white" style={{ fontFamily: "Futura", fontWeight: 500, fontSize: 16 }}>
          {exercise.name}
        </p>
      </div>

      {/* Media Section (Video/Image) */}
      <div className="w-full h-30 bg-gray-200 flex items-center justify-center">
        {isVideo ? (
          <video src={src} className="w-full h-full object-cover" autoPlay loop playsInline />
        ) : (
          <img src={src} alt={exercise.name} className="w-full h-full object-cover" />
        )}
      </div>

      {/* Bottom Section (Equipment) */}
      <div className="ex-slanted-bottom rounded-b-xl flex items-center justify-end pr-3">
        <p className="text-white" style={{ fontFamily: "Futura", fontWeight: 500, fontSize: 22 }}>
          ({exercise.equipment})
        </p>
      </div>

      {/* Heart Icon for Favoriting */}
      <button className="absolute top-[24px] right-[5px] text-[30px] z-20" onClick={toggleFavorite}>
        {exercise.favourite ? <FaHeart fill="#D3442F" /> : <FaRegHeart fill="#D3442F" />}
      </button>
      <div className="absolute top-[24px] right-[4px] text-[32px] z-10">
        <FaHeart fill="#FFF" />
      </div>
    </motion.div>
  );
};

export default ExerciseCard;
